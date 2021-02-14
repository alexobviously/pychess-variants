import asyncio
import collections
import logging
import random
import string
from datetime import datetime
from itertools import chain
from time import monotonic

try:
    import pyffish as sf
    sf.set_option("VariantPath", "variants.ini")
except ImportError:
    print("No pyffish module installed!")

from broadcast import lobby_broadcast
from clock import Clock
from compress import encode_moves, R2C
from const import CREATED, STARTED, ABORTED, MATE, STALEMATE, DRAW, FLAG, CLAIM, \
    INVALIDMOVE, VARIANT_960_TO_PGN, LOSERS, VARIANTEND, GRANDS, CASUAL, RATED, IMPORTED
from convert import grand2zero, uci2usi, mirror5, mirror9
from fairy import FairyBoard, BLACK, WHITE, FILES
from glicko2.glicko2 import gl2, PROVISIONAL_PHI
from settings import URI

log = logging.getLogger(__name__)

MAX_HIGH_SCORE = 10
MAX_PLY = 600
KEEP_TIME = 600  # keep game in app["games"] for KEEP_TIME secs


async def new_game_id(db):
    new_id = "".join(random.choice(string.ascii_letters + string.digits) for x in range(8))
    existing = await db.game.find_one({'_id': {'$eq': new_id}})
    if existing:
        new_id = "".join(random.choice(string.digits + string.ascii_letters) for x in range(8))
    return new_id


class Game:
    def __init__(self, app, gameId, variant, initial_fen, wplayer, bplayer, base=1, inc=0, byoyomi_period=0, level=0, rated=CASUAL, chess960=False, create=True):
        self.app = app
        self.db = app["db"] if "db" in app else None
        self.users = app["users"]
        self.games = app["games"]
        self.highscore = app["highscore"]
        self.db_crosstable = app["crosstable"]

        self.saved = False
        self.variant = variant
        self.initial_fen = initial_fen
        self.wplayer = wplayer
        self.bplayer = bplayer
        self.rated = rated
        self.base = base
        self.inc = inc
        self.level = level if level is not None else 0
        self.chess960 = chess960
        self.create = create

        # rating info
        self.white_rating = wplayer.get_rating(variant, chess960)
        self.wrating = "%s%s" % (int(round(self.white_rating.mu, 0)), "?" if self.white_rating.phi > PROVISIONAL_PHI else "")
        self.wrdiff = 0
        self.black_rating = bplayer.get_rating(variant, chess960)
        self.brating = "%s%s" % (int(round(self.black_rating.mu, 0)), "?" if self.black_rating.phi > PROVISIONAL_PHI else "")
        self.brdiff = 0

        # crosstable info
        self.need_crosstable_save = False
        self.bot_game = self.bplayer.bot or self.wplayer.bot
        if self.bot_game or self.wplayer.anon or self.bplayer.anon:
            self.crosstable = ""
        else:
            if self.wplayer.username < self.bplayer.username:
                self.s1player = self.wplayer.username
                self.s2player = self.bplayer.username
            else:
                self.s1player = self.bplayer.username
                self.s2player = self.wplayer.username
            self.ct_id = self.s1player + "/" + self.s2player
            self.crosstable = self.db_crosstable.get(self.ct_id, {"_id": self.ct_id, "s1": 0, "s2": 0, "r": []})

        self.spectators = set()
        self.draw_offers = set()
        self.rematch_offers = set()
        self.messages = collections.deque([], 200)
        self.date = datetime.utcnow()

        self.ply_clocks = [{
            "black": (base * 1000 * 60) + 0 if base > 0 else inc * 1000,
            "white": (base * 1000 * 60) + 0 if base > 0 else inc * 1000,
            "movetime": 0
        }]
        self.dests = {}
        self.promotions = []
        self.lastmove = None
        self.check = False
        self.status = CREATED
        self.result = "*"
        self.last_server_clock = monotonic()

        self.id = gameId

        # Makruk manual counting
        use_manual_counting = self.variant in ("makruk", "makpong", "cambodian")
        self.manual_count = use_manual_counting and not self.bot_game
        self.manual_count_toggled = []

        # Calculate the start of manual counting
        count_started = 0
        if self.manual_count:
            count_started = -1
            if self.initial_fen:
                parts = self.initial_fen.split()
                board_state = parts[0]
                side_to_move = parts[1]
                counting_limit = int(parts[3]) if len(parts) >= 4 and parts[3].isdigit() else 0
                counting_ply = int(parts[4]) if len(parts) >= 5 else 0
                move_number = int(parts[5]) if len(parts) >= 6 else 0

                white_pieces = sum(1 for c in board_state if c.isupper())
                black_pieces = sum(1 for c in board_state if c.islower())
                if counting_limit > 0 and counting_ply > 0:
                    if white_pieces <= 1 or black_pieces <= 1:
                        # Disable manual count if either side is already down to lone king
                        count_started = 0
                        self.manual_count = False
                    else:
                        last_ply = 2 * move_number - (2 if side_to_move == 'w' else 1)
                        count_started = last_ply - counting_ply + 1
                        if count_started < 1:
                            # Move number is too small for the current count
                            count_started = 0
                            self.manual_count = False
                        else:
                            counting_player = self.bplayer if counting_ply % 2 == 0 else self.wplayer
                            self.draw_offers.add(counting_player.username)

        if self.chess960 and self.initial_fen and self.create:
            if self.wplayer.fen960_as_white == self.initial_fen:
                self.initial_fen = ""

        self.board = self.create_board(self.variant, self.initial_fen, self.chess960, count_started)

        # Janggi setup needed when player is not BOT
        if self.variant == "janggi":
            if self.initial_fen:
                self.bsetup = False
                self.wsetup = False
            else:
                self.bsetup = not self.bplayer.bot
                self.wsetup = not self.wplayer.bot
                if self.bplayer.bot:
                    self.board.janggi_setup("b")
        
        # Musketeer prelude setup needed
        # todo: we need to know whether we have done the prelude stage yet, I don't totally understand the logic of the janggi part - it seems like initial_fen is always set?
        if self.variant == "musketeer":
            self.prelude = 0 # 0,1: w+b select pieces; 2,3: w+b place first pieces; 4+5: w+b place second pieces
            self.prelude_pieces = []
            self.prelude_positions = []

        self.overtime = False
        self.byoyomi = byoyomi_period > 0
        self.byoyomi_period = byoyomi_period

        # Remaining byoyomi periods by players
        self.byoyomi_periods = [byoyomi_period, byoyomi_period]

        # On page refresh we have to add extra byoyomi times gained by current player to report correct clock time
        # We adjust this in "byoyomi" messages in wsr.py
        self.byo_correction = 0

        self.initial_fen = self.board.initial_fen
        self.wplayer.fen960_as_white = self.initial_fen

        self.random_mover = self.wplayer.username == "Random-Mover" or self.bplayer.username == "Random-Mover"
        self.random_move = ""

        self.set_dests()
        if self.board.move_stack:
            self.check = self.board.is_checked()

        self.steps = [{
            "fen": self.initial_fen if self.initial_fen else self.board.initial_fen,
            "san": None,
            "turnColor": "black" if self.board.color == BLACK else "white",
            "check": self.check}
        ]

        self.stopwatch = Clock(self)

        if not self.bplayer.bot:
            self.bplayer.game_in_progress = self.id
        if not self.wplayer.bot:
            self.wplayer.game_in_progress = self.id

    @staticmethod
    def create_board(variant, initial_fen, chess960, count_started):
        return FairyBoard(variant, initial_fen, chess960, count_started)

    async def play_move(self, move, clocks=None, ply=None):
        self.stopwatch.stop()
        self.byo_correction = 0

        if self.status > STARTED:
            return
        if self.status == CREATED:
            self.status = STARTED
            self.app["g_cnt"] += 1
            response = {"type": "g_cnt", "cnt": self.app["g_cnt"]}
            await lobby_broadcast(self.app["lobbysockets"], response)

        cur_player = self.bplayer if self.board.color == BLACK else self.wplayer
        opp_player = self.wplayer if self.board.color == BLACK else self.bplayer

        if self.board.count_started <= 0:
            # Move cancels draw offer
            # Except in manual counting, since it is a permanent draw offer
            self.draw_offers.discard(opp_player.username)

        cur_time = monotonic()
        # BOT players doesn't send times used for moves
        if self.bot_game:
            movetime = int(round((cur_time - self.last_server_clock) * 1000))
            # print(self.board.ply, move, movetime)
            if clocks is None:
                clocks = {
                    "white": self.ply_clocks[-1]["white"],
                    "black": self.ply_clocks[-1]["black"],
                    "movetime": movetime
                }

            if cur_player.bot and self.board.ply >= 2:
                cur_color = "black" if self.board.color == BLACK else "white"
                if self.byoyomi:
                    if self.overtime:
                        clocks[cur_color] = self.inc * 1000
                    else:
                        clocks[cur_color] = max(0, self.clocks[cur_color] - movetime)
                else:
                    clocks[cur_color] = max(0, self.clocks[cur_color] - movetime + (self.inc * 1000))

                if clocks[cur_color] == 0:
                    if self.byoyomi and self.byoyomi_periods[cur_color] > 0:
                        self.overtime = True
                        clocks[cur_color] = self.inc * 1000
                        self.byoyomi_periods[cur_color] -= 1
                    else:
                        w, b = self.board.insufficient_material()
                        if (w and b) or (cur_color == "black" and w) or (cur_color == "white" and b):
                            result = "1/2-1/2"
                        else:
                            result = "1-0" if self.board.color == BLACK else "0-1"
                        self.update_status(FLAG, result)
                        print(self.result, "flag")
                        await self.save_game()

        self.last_server_clock = cur_time

        if self.status <= STARTED:
            try:
                san = self.board.get_san(move)
                self.lastmove = move
                self.board.push(move)
                self.ply_clocks.append(clocks)
                self.set_dests()
                self.update_status()

                # Stop manual counting when the king is bared
                if self.board.count_started > 0:
                    board_state = self.board.fen.split()[0]
                    white_pieces = sum(1 for c in board_state if c.isupper())
                    black_pieces = sum(1 for c in board_state if c.islower())
                    if white_pieces <= 1 or black_pieces <= 1:
                        self.stop_manual_count()
                        self.board.count_started = 0

                if self.status > STARTED:
                    await self.save_game()

                self.steps.append({
                    "fen": self.board.fen,
                    "move": move,
                    "san": san,
                    "turnColor": "black" if self.board.color == BLACK else "white",
                    "check": self.check}
                )
                self.stopwatch.restart()

            except Exception:
                log.exception("ERROR: Exception in game %s play_move() %s", self.id, move)
                result = "1-0" if self.board.color == BLACK else "0-1"
                self.update_status(INVALIDMOVE, result)
                await self.save_game()

            # TODO: this causes random game abort
            if False:  # not self.bot_game:
                # print("--------------ply-", ply)
                # print(self.board.color, clocks, self.ply_clocks)
                opp_color = self.steps[-1]["turnColor"]
                if clocks[opp_color] < self.ply_clocks[ply - 1][opp_color] and self.status <= STARTED:
                    self.update_status(ABORTED)
                    await self.save_game(with_clocks=True)

    async def save_game(self, with_clocks=False):
        if self.saved:
            return
        if self.rated == IMPORTED:
            log.exception("Save IMPORTED game %s ???", self.id)
            return

        self.stopwatch.kill()

        if self.board.ply > 0:
            self.app["g_cnt"] -= 1
            response = {"type": "g_cnt", "cnt": self.app["g_cnt"]}
            await lobby_broadcast(self.app["lobbysockets"], response)

        async def remove(keep_time):
            # Keep it in our games dict a little to let players get the last board
            # not to mention that BOT players want to abort games after 20 sec inactivity
            await asyncio.sleep(keep_time)

            try:
                del self.games[self.id]
            except KeyError:
                log.error("Failed to del %s from games", self.id)

            if self.bot_game:
                try:
                    if self.wplayer.bot:
                        del self.wplayer.game_queues[self.id]
                    if self.bplayer.bot:
                        del self.bplayer.game_queues[self.id]
                except KeyError:
                    log.error("Failed to del %s from game_queues", self.id)

        self.saved = True
        loop = asyncio.get_event_loop()
        loop.create_task(remove(KEEP_TIME))

        if self.board.ply < 3 and (self.db is not None):
            result = await self.db.game.delete_one({"_id": self.id})
            log.debug("Removed too short game %s from db. Deleted %s game.", self.id, result.deleted_count)
        else:
            if self.result != "*":
                if self.rated == RATED:
                    await self.update_ratings()
                if (not self.bot_game) and (not self.wplayer.anon) and (not self.bplayer.anon):
                    await self.save_crosstable()

            # self.print_game()

            new_data = {
                "d": self.date,
                "f": self.board.fen,
                "s": self.status,
                "r": R2C[self.result],
                'm': encode_moves(
                    map(grand2zero, self.board.move_stack) if self.variant in GRANDS
                    else self.board.move_stack, self.variant)}

            if self.rated == RATED and self.result != "*":
                new_data["p0"] = self.p0
                new_data["p1"] = self.p1

            # Janggi game starts with a prelude phase to set up horses and elephants, so
            # initial FEN may be different compared to one we used when db game document was created
            if self.variant == "janggi":
                new_data["if"] = self.board.initial_fen

            if with_clocks:
                new_data["clocks"] = self.ply_clocks

            if self.manual_count:
                if self.board.count_started > 0:
                    self.manual_count_toggled.append((self.board.count_started, self.board.ply + 1))
                new_data["mct"] = self.manual_count_toggled

            if self.db is not None:
                await self.db.game.find_one_and_update({"_id": self.id}, {"$set": new_data})

    def set_crosstable(self):
        if self.bot_game or self.wplayer.anon or self.bplayer.anon or self.board.ply < 3 or self.result == "*":
            return

        if len(self.crosstable["r"]) > 0 and self.crosstable["r"][-1].startswith(self.id):
            print("Crosstable was already updated with %s result" % self.id)
            return

        if self.result == "1/2-1/2":
            s1 = s2 = 5
            tail = "="
        elif (self.result == "1-0" and self.s1player == self.wplayer.username) or (self.result == "0-1" and self.s1player == self.bplayer.username):
            s1 = 10
            s2 = 0
            tail = "+"
        else:
            s1 = 0
            s2 = 10
            tail = "-"

        self.crosstable["s1"] += s1
        self.crosstable["s2"] += s2
        self.crosstable["r"].append("%s%s" % (self.id, tail))
        self.crosstable["r"] = self.crosstable["r"][-20:]

        new_data = {
            "_id": self.ct_id,
            "s1": self.crosstable["s1"],
            "s2": self.crosstable["s2"],
            "r": self.crosstable["r"],
        }
        self.db_crosstable[self.ct_id] = new_data

        self.need_crosstable_save = True

    async def save_crosstable(self):
        if not self.need_crosstable_save:
            print("Crosstable update for %s was already saved to mongodb" % self.id)
            return

        new_data = {
            "s1": self.crosstable["s1"],
            "s2": self.crosstable["s2"],
            "r": self.crosstable["r"],
        }
        try:
            await self.db.crosstable.find_one_and_update({"_id": self.ct_id}, {"$set": new_data}, upsert=True)
        except Exception:
            if self.db is not None:
                log.error("Failed to save new crosstable to mongodb!")

        self.need_crosstable_save = False

    def get_highscore(self, variant, chess960):
        len_hs = len(self.highscore[variant + ("960" if chess960 else "")])
        if len_hs > 0:
            return (self.highscore[variant + ("960" if chess960 else "")].peekitem()[1], len_hs)
        return (0, 0)

    async def set_highscore(self, variant, chess960, value):
        self.highscore[variant + ("960" if chess960 else "")].update(value)
        # We have to preserve previous top 10!
        # See test_win_and_in_then_lost_and_out() in test.py
        # if len(self.highscore[variant + ("960" if chess960 else "")]) > MAX_HIGH_SCORE:
        #     self.highscore[variant + ("960" if chess960 else "")].popitem()

        new_data = {"scores": dict(self.highscore[variant + ("960" if chess960 else "")].items()[:10])}
        try:
            await self.db.highscore.find_one_and_update({"_id": variant + ("960" if chess960 else "")}, {"$set": new_data}, upsert=True)
        except Exception:
            if self.db is not None:
                log.error("Failed to save new highscore to mongodb!")

    async def update_ratings(self):
        if self.result == '1-0':
            (white_score, black_score) = (1.0, 0.0)
        elif self.result == '1/2-1/2':
            (white_score, black_score) = (0.5, 0.5)
        elif self.result == '0-1':
            (white_score, black_score) = (0.0, 1.0)
        else:
            raise RuntimeError('game.result: unexpected result code')
        wr, br = self.white_rating, self.black_rating
        # print("ratings before updated:", wr, br)
        wr = gl2.rate(self.white_rating, [(white_score, br)])
        br = gl2.rate(self.black_rating, [(black_score, wr)])
        # print("ratings after updated:", wr, br)
        await self.wplayer.set_rating(self.variant, self.chess960, wr)
        await self.bplayer.set_rating(self.variant, self.chess960, br)

        self.wrdiff = int(round(wr.mu - self.white_rating.mu, 0))
        self.p0 = {"e": self.wrating, "d": self.wrdiff}

        self.brdiff = int(round(br.mu - self.black_rating.mu, 0))
        self.p1 = {"e": self.brating, "d": self.brdiff}

        await self.set_highscore(self.variant, self.chess960, {self.wplayer.username: int(round(wr.mu, 0))})
        await self.set_highscore(self.variant, self.chess960, {self.bplayer.username: int(round(br.mu, 0))})

    def update_status(self, status=None, result=None):
        def result_string_from_value(color, game_result_value):
            if game_result_value < 0:
                return "1-0" if color == BLACK else "0-1"
            if game_result_value > 0:
                return "0-1" if color == BLACK else "1-0"
            return "1/2-1/2"

        if status is not None:
            self.status = status
            if result is not None:
                self.result = result

            self.set_crosstable()

            if not self.bplayer.bot:
                self.bplayer.game_in_progress = None
            if not self.wplayer.bot:
                self.wplayer.game_in_progress = None
            return

        if self.board.move_stack:
            self.check = self.board.is_checked()

        w, b = self.board.insufficient_material()
        if w and b:
            print("1/2 by board.insufficient_material()")
            self.status = DRAW
            self.result = "1/2-1/2"

        if not self.dests:
            game_result_value = self.board.game_result()
            self.result = result_string_from_value(self.board.color, game_result_value)

            if self.board.is_immediate_game_end()[0]:
                self.status = VARIANTEND
                print(self.result, "variant end")
            elif self.check:
                self.status = MATE
                # Draw if the checkmating player is the one counting
                if self.board.count_started > 0:
                    counting_side = 'b' if self.board.count_started % 2 == 0 else 'w'
                    if self.result == ("1-0" if counting_side == 'w' else "0-1"):
                        self.status = DRAW
                        self.result = "1/2-1/2"
                print(self.result, "checkmate")
            else:
                # being in stalemate loses in xiangqi and shogi variants
                self.status = STALEMATE
                print(self.result, "stalemate")

        elif self.variant in ('makruk', 'makpong', 'cambodian', 'sittuyin'):
            parts = self.board.fen.split()
            if parts[3].isdigit():
                counting_limit = int(parts[3])
                counting_ply = int(parts[4])
                if counting_ply > counting_limit:
                    self.status = DRAW
                    self.result = "1/2-1/2"
                    print(self.result, "counting limit reached")

        else:
            # end the game by 50 move rule and repetition automatically
            # for non-draw results and bot games
            is_game_end, game_result_value = self.board.is_optional_game_end()
            if is_game_end and (game_result_value != 0 or (self.wplayer.bot or self.bplayer.bot)):
                self.result = result_string_from_value(self.board.color, game_result_value)
                self.status = CLAIM if game_result_value != 0 else DRAW
                print(self.result, "claim")

        if self.board.ply > MAX_PLY:
            self.status = DRAW
            self.result = "1/2-1/2"
            print(self.result, "Ply %s reached" % MAX_PLY)

        if self.status > STARTED:
            self.set_crosstable()
            if not self.bplayer.bot:
                self.bplayer.game_in_progress = None
            if not self.wplayer.bot:
                self.wplayer.game_in_progress = None

    def set_dests(self):
        dests = {}
        promotions = []
        moves = self.board.legal_moves()
        # print("self.board.legal_moves()", moves)
        if self.random_mover:
            self.random_move = random.choice(moves) if moves else ""
            # print("RM: %s" % self.random_move)

        for move in moves:
            if self.variant in GRANDS:
                move = grand2zero(move)
            source, dest = move[0:2], move[2:4]
            if source in dests:
                dests[source].append(dest)
            else:
                dests[source] = [dest]

            if not move[-1].isdigit():
                if not (self.variant in ("seirawan", "shouse") and (move[1] == '1' or move[1] == '8')):
                    promotions.append(move)

            if self.variant == "kyotoshogi" and move[0] == "+":
                promotions.append(move)

        self.dests = dests
        self.promotions = promotions

    # Handles everything to do with the prelude stage for the Musketeer variant
    # move parameter is an algebraic move string
    # Pass an empty string to initialise it
    def musketeer_prelude(self, move):
        print(['prelude', move])
        if move != '':
            from_square = move[0:2]
            to_square = move[2:4]
        else:
            from_square = to_square = ''
        setup_positions = {'L': 'a2', 'S': 'b2', 'D': 'c2', 'F': 'd2', 'U': 'e2',
                                'O': 'a3', 'H': 'b3', 'E': 'c3', 'A': 'd3', 'C': 'e3',
                                'l': 'd7', 's': 'e7', 'd': 'f7', 'f': 'g7', 'u': 'h7',
                                'o': 'd6', 'h': 'e6', 'e': 'f6', 'a': 'g6', 'c': 'h6'}
        if self.prelude_pieces == None: self.prelude_pieces = []
        if self.prelude_positions == None: self.prelude_positions = []
        # select/place the piece that was just moved
        if len(self.prelude_pieces) < 2:
            white_turn = len(self.prelude_pieces) == 0
            if from_square != '' and from_square in setup_positions.values():
                piece = list(setup_positions.keys())[list(setup_positions.values()).index(from_square)]
                piece = piece.upper() if white_turn else piece.lower()
                self.prelude_pieces.append(piece)
            else:
                pass # todo: failed validation
        else:
            white_turn = (len(self.prelude_positions) % 2) == 0
            placement_pieces = {'d4': self.prelude_pieces[0].upper(), 'e4': self.prelude_pieces[1].upper(), 'e5': self.prelude_pieces[0].lower(), 'd5': self.prelude_pieces[1].lower()}
            if from_square != '' and from_square in ['d4', 'e4', 'd5', 'e5'] and move[3] in ['1', '8']:
                piece = placement_pieces[from_square]
                piece = piece.upper() if white_turn else piece.lower()
                self.prelude_positions.append([piece, to_square])
            else:
                pass # todo: failed validation
        # build fen and dests
        num_prelude_pieces = len(self.prelude_pieces)
        if num_prelude_pieces < 2:
            # remove selected pieces
            for p in self.prelude_pieces: 
                if p in setup_positions: del setup_positions[p]
            # set dests
            dests = {}
            player_positions = list(filter(lambda x: x.isupper() if white_turn else x.islower(), setup_positions))
            for p in player_positions:
                dests[setup_positions[p]] = ['h3'] if white_turn else ['a7']
            # create fen
            print(["setup fen", "prelude_pieces", self.prelude_pieces])
            part1 = ('3' + ('lsdfu'.replace(self.prelude_pieces[0].lower(), '1') if num_prelude_pieces > 0 else 'lsdfu')).replace('31', '4').replace('21', '3')
            part2 = (('3' if num_prelude_pieces == 0 else (self.prelude_pieces[0].lower() + '2')) + ('oheac'.replace(self.prelude_pieces[0].lower(), '1') if num_prelude_pieces > 0 else 'oheac')).replace('31', '4').replace('21', '3')
            part3 = (('OHEAC'.replace(self.prelude_pieces[0].upper(), '1') if num_prelude_pieces > 0 else 'OHEAC') + ('3' if num_prelude_pieces == 0 else ('2' + self.prelude_pieces[0].upper()))).replace('13', '4').replace('12', '3')
            part4 = (('LSDFU'.replace(self.prelude_pieces[0].upper(), '1') if num_prelude_pieces > 0 else 'LSDFU') + '3').replace('13', '4').replace('12', '3')
            print(["parts", part1, part2, part3, part4])
            col = 'w' if white_turn else 'b'
            _fen = f'********/8/{part1}/{part2}/8/8/{part3}/{part4}/8/******** {col} KQkq - 0 1'
        else:
            placement_pieces = {'d4': self.prelude_pieces[0].upper(), 'e4': self.prelude_pieces[1].upper(), 'e5': self.prelude_pieces[0].lower(), 'd5': self.prelude_pieces[1].lower()}
            white_dests = list(map(lambda x: x+'1', FILES[0:8]))
            black_dests = list(map(lambda x: x+'8', FILES[0:8]))
            # pockets
            white_pocket = ['*']*8
            black_pocket = ['*']*8
            for p in self.prelude_positions:
                piece = p[0]
                square = p[1]
                if square[1] in ['1', '8']:
                    if square[1] == '1':
                        white_pocket[FILES.index(square[0])] = piece
                    else:
                        black_pocket[FILES.index(square[0])] = piece
            white_pocket_fen = ''.join(white_pocket)
            black_pocket_fen = ''.join(black_pocket)
            # if we've finished the prelude stage then we can switch to the normal fen
            if len(self.prelude_positions) == 4:
                self.status = STARTED
                _fen = f'{black_pocket_fen}/rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR/{white_pocket_fen} w KQkq - 0 1'
                self.board.fen = _fen
                self.board.initial_fen = _fen
                self.steps[0]['fen'] = _fen
                self.set_dests()
                return _fen, self.dests
            # remove placed pieces
            for p in self.prelude_positions:
                if p[1] in white_dests: del white_dests[white_dests.index(p[1])]
                if p[1] in black_dests: del black_dests[black_dests.index(p[1])]
                if p[0] in placement_pieces.values():
                    del placement_pieces[list(placement_pieces.keys())[list(placement_pieces.values()).index(p[0])]]
            # set dests
            dests = {}
            for p in placement_pieces:
                dests[p] = white_dests if placement_pieces[p].isupper() else black_dests
            # create fen
            part1 = ('3' + (placement_pieces['d5'] if 'd5' in placement_pieces else '1') + (placement_pieces['e5'] if 'e5' in placement_pieces else '1') + '3').replace('31', '4').replace('13', '4')
            part2 = ('3' + (placement_pieces['d4'] if 'd4' in placement_pieces else '1') + (placement_pieces['e4'] if 'e4' in placement_pieces else '1') + '3').replace('31', '4').replace('13', '4')
            part3 = ''
            part4 = ''

            col = 'w' if white_turn else 'b'
            _fen = f'{black_pocket_fen}/8/rnbqkbnr/pppppppp/{part1}/{part2}/PPPPPPPP/RNBQKBNR/8/{white_pocket_fen} {col} KQkq - 0 1'
        print(["_fen", _fen, "self.board.fen", self.board.fen])
        self.board.fen = _fen
        print(["_fen", _fen, "self.board.fen", self.board.fen])
        self.board.initial_fen = _fen
        self.steps[0]['fen'] = _fen
        promotions = []
        self.dests = dests
        self.promotions = promotions
        return _fen, dests

    def print_game(self):
        print(self.pgn)
        print(self.board.print_pos())
        # print(self.board.move_stack)
        # print("---CLOCKS---")
        # for ply, clocks in enumerate(self.ply_clocks):
        #     print(ply, self.board.move_stack[ply - 1] if ply > 0 else "", self.ply_clocks[ply]["movetime"], self.ply_clocks[ply]["black"], self.ply_clocks[ply]["white"])
        # print(self.result)

    @property
    def pgn(self):
        try:
            mlist = sf.get_san_moves(self.variant, self.initial_fen, self.board.move_stack, self.chess960, sf.NOTATION_SAN)
        except Exception:
            log.exception("ERROR: Exception in game %s pgn()", self.id)
            mlist = self.board.move_stack
        moves = " ".join((move if ind % 2 == 1 else "%s. %s" % (((ind + 1) // 2) + 1, move) for ind, move in enumerate(mlist)))
        no_setup = self.initial_fen == self.board.start_fen("chess") and not self.chess960
        # Use lichess format for crazyhouse games to support easy import
        setup_fen = self.initial_fen if self.variant != "crazyhouse" else self.initial_fen.replace("[]", "")
        tc = "-" if self.base + self.inc == 0 else "%s+%s" % (int(self.base * 60), self.inc)
        return '[Event "{}"]\n[Site "{}"]\n[Date "{}"]\n[Round "-"]\n[White "{}"]\n[Black "{}"]\n[Result "{}"]\n[TimeControl "{}"]\n[WhiteElo "{}"]\n[BlackElo "{}"]\n[Variant "{}"]\n{fen}{setup}\n{} {}\n'.format(
            "PyChess " + ("rated" if self.rated == RATED else "casual" if self.rated == CASUAL else "imported") + " game",
            URI + "/" + self.id,
            self.date.strftime("%Y.%m.%d"),
            self.wplayer.username,
            self.bplayer.username,
            self.result,
            tc,
            self.wrating,
            self.brating,
            self.variant.capitalize() if not self.chess960 else VARIANT_960_TO_PGN[self.variant],
            moves,
            self.result,
            fen="" if no_setup else '[FEN "%s"]\n' % setup_fen,
            setup="" if no_setup else '[SetUp "1"]\n')

    @property
    def uci_usi(self):
        if self.variant[-5:] == "shogi":
            mirror = mirror9 if self.variant == "shogi" else mirror5
            return "position sfen %s moves %s" % (self.board.initial_sfen, " ".join(map(uci2usi, map(mirror, self.board.move_stack))))
        return "position fen %s moves %s" % (self.board.initial_fen, " ".join(self.board.move_stack))

    @property
    def clocks(self):
        return self.ply_clocks[-1]

    @property
    def is_claimable_draw(self):
        return self.board.is_claimable_draw()

    @property
    def spectator_list(self):
        spectators = (spectator.username for spectator in self.spectators if not spectator.anon)
        anons = ()
        anon = sum(1 for user in self.spectators if user.anon)

        cnt = len(self.spectators)
        if cnt > 10:
            spectators = str(cnt)
        else:
            if anon > 0:
                anons = ("Anonymous(%s)" % anon,)
            spectators = ", ".join(chain(spectators, anons))
        return {"type": "spectators", "spectators": spectators, "gameId": self.id}

    def analysis_start(self, username):
        return '{"type": "analysisStart", "username": "%s", "game": {"id": "%s", "skill_level": "%s", "chess960": "%s"}}\n' % (username, self.id, self.level, self.chess960)

    @property
    def game_start(self):
        return '{"type": "gameStart", "game": {"id": "%s", "skill_level": "%s", "chess960": "%s"}}\n' % (self.id, self.level, self.chess960)

    @property
    def game_end(self):
        return '{"type": "gameEnd", "game": {"id": "%s"}}\n' % self.id

    @property
    def game_full(self):
        return '{"type": "gameFull", "id": "%s", "variant": {"name": "%s"}, "white": {"name": "%s"}, "black": {"name": "%s"}, "initialFen": "%s", "state": %s}\n' % (self.id, self.variant, self.wplayer.username, self.bplayer.username, self.initial_fen, self.game_state[:-1])

    @property
    def game_state(self):
        clocks = self.clocks
        return '{"type": "gameState", "moves": "%s", "wtime": %s, "btime": %s, "winc": %s, "binc": %s}\n' % (" ".join(self.board.move_stack), clocks["white"], clocks["black"], self.inc, self.inc)

    async def abort(self):
        self.update_status(ABORTED)
        await self.save_game()
        return {"type": "gameEnd", "status": self.status, "result": "Game aborted.", "gameId": self.id, "pgn": self.pgn}

    async def game_ended(self, user, reason):
        """ Abort, resign, flag, abandone """
        if self.result == "*":
            if reason == "abort":
                result = "*"
            else:
                if reason == "flag":
                    w, b = self.board.insufficient_material()
                    if (w and b) or (self.board.color == BLACK and w) or (self.board.color == WHITE and b):
                        result = "1/2-1/2"
                    else:
                        result = "0-1" if user.username == self.wplayer.username else "1-0"
                else:
                    result = "0-1" if user.username == self.wplayer.username else "1-0"

            self.update_status(LOSERS[reason], result)
            await self.save_game()

        return {
            "type": "gameEnd", "status": self.status, "result": self.result, "gameId": self.id, "pgn": self.pgn, "ct": self.crosstable,
            "rdiffs": {"brdiff": self.brdiff, "wrdiff": self.wrdiff} if self.status > STARTED and self.rated == RATED else ""}

    def start_manual_count(self):
        if self.manual_count:
            cur_player = self.bplayer if self.board.color == BLACK else self.wplayer
            opp_player = self.wplayer if self.board.color == BLACK else self.bplayer
            self.draw_offers.discard(opp_player.username)
            self.draw_offers.add(cur_player.username)
            self.board.count_started = self.board.ply + 1

    def stop_manual_count(self):
        if self.manual_count:
            cur_player = self.bplayer if self.board.color == BLACK else self.wplayer
            opp_player = self.wplayer if self.board.color == BLACK else self.bplayer
            self.draw_offers.discard(cur_player.username)
            self.draw_offers.discard(opp_player.username)
            self.manual_count_toggled.append((self.board.count_started, self.board.ply + 1))
            self.board.count_started = -1

    def get_board(self, full=False):
        if full:
            steps = self.steps

            # To not touch self.ply_clocks we are creating deep copy from clocks
            clocks = {"black": self.clocks["black"], "white": self.clocks["white"]}

            if self.status == STARTED and self.board.ply >= 2:
                # We have to adjust current player latest saved clock time
                # unless he will get free extra time on browser page refresh
                # (also needed for spectators entering to see correct clock times)

                cur_time = monotonic()
                elapsed = int(round((cur_time - self.last_server_clock) * 1000))

                cur_color = "black" if self.board.color == BLACK else "white"
                clocks[cur_color] = max(0, clocks[cur_color] + self.byo_correction - elapsed)
            crosstable = self.crosstable
        else:
            clocks = self.clocks
            steps = (self.steps[-1],)
            crosstable = self.crosstable if self.status > STARTED else ""

        if self.byoyomi:
            byoyomi_periods = self.byoyomi_periods
        else:
            byoyomi_periods = ""

        return {"type": "board",
                "gameId": self.id,
                "status": self.status,
                "result": self.result,
                "fen": self.board.fen,
                "lastMove": self.lastmove,
                "steps": steps,
                "dests": self.dests,
                "promo": self.promotions,
                "check": self.check,
                "ply": self.board.ply,
                "clocks": {"black": clocks["black"], "white": clocks["white"]},
                "byo": byoyomi_periods,
                "pgn": self.pgn if self.status > STARTED else "",
                "rdiffs": {"brdiff": self.brdiff, "wrdiff": self.wrdiff} if self.status > STARTED and self.rated == RATED else "",
                "uci_usi": self.uci_usi if self.status > STARTED else "",
                "rm": self.random_move if self.status <= STARTED else "",
                "ct": crosstable,
                }
