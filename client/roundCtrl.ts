import Sockette from 'sockette';

import { init } from 'snabbdom';
import { h } from 'snabbdom/h';
import { VNode } from 'snabbdom/vnode';
import klass from 'snabbdom/modules/class';
import attributes from 'snabbdom/modules/attributes';
import properties from 'snabbdom/modules/props';
import listeners from 'snabbdom/modules/eventlisteners';

import { key2pos, pos2key } from 'chessgroundx/util';
import { Chessground } from 'chessgroundx';
import { Api } from 'chessgroundx/api';
import { Color, Dests, Pieces, PiecesDiff, Role, Key, Pos, Piece, Variant, Notation, SetPremoveMetadata } from 'chessgroundx/types';

import { JSONObject } from './types';
import { _ } from './i18n';
import { boardSettings } from './boardSettings';
import { Clock } from './clock';
import { Gating } from './gating';
import { Promotion } from './promotion';
import { dropIsValid, pocketView, updatePockets, Pockets, updateCommittedGates } from './pocket';
import { sound } from './sound';
import { roleToSan, grand2zero, zero2grand, VARIANTS, getPockets, getCounting, isVariantClass, isHandicap, splitMusketeerFen, rolesVariants } from './chess';
import { crosstableView } from './crosstable';
import { chatMessage, chatView } from './chat';
import { createMovelistButtons, updateMovelist, selectMove } from './movelist';
import { renderRdiff, result } from './profile'
import { player } from './player';
import { updateCount, updatePoint } from './info';

const patch = init([klass, attributes, properties, listeners]);

export default class RoundController {
    model;
    sock;
    chessground: Api;
    fullfen: string;
    wplayer: string;
    bplayer: string;
    base: number;
    inc: number;
    byoyomi: boolean;
    byoyomiPeriod: number;
    mycolor: Color;
    oppcolor: Color;
    turnColor: Color;
    clocks: [Clock, Clock];
    clocktimes;
    abortable: boolean;
    gameId: string;
    variant: string;
    hasPockets: boolean;
    pockets: Pockets;
    vpocket0: VNode;
    vpocket1: VNode;
    vplayer0: VNode;
    vplayer1: VNode;
    vgate0: VNode;
    vgate1: VNode;
    vmiscInfoW: VNode;
    vmiscInfoB: VNode;
    vpng: VNode;
    vmovelist: VNode | HTMLElement;
    gameControls: VNode;
    moveControls: VNode;
    ctableContainer: VNode | HTMLElement;
    gating: Gating;
    promotion: Promotion;
    dests: Dests;
    promotions: string[];
    lastmove: Key[];
    premove: {orig: Key, dest: Key, metadata?: SetPremoveMetadata} | null;
    predrop: {role: Role, key: Key} | null;
    preaction: boolean;
    result: string;
    flip: boolean;
    spectator: boolean;
    settings: boolean;
    tv: boolean;
    status: number;
    steps;
    pgn: string;
    ply: number;
    players: string[];
    titles: string[];
    ratings: string[];
    clickDrop: Piece | undefined;
    clickDropEnabled: boolean;
    animation: boolean;
    showDests: boolean;
    blindfold: boolean;
    handicap: boolean;
    autoqueen: boolean;
    setupFen: string;
    prevPieces: Pieces;
    committedGates: any;
    hasCommittedGates: boolean;

    constructor(el, model) {
        const onOpen = (evt) => {
            console.log("ctrl.onOpen()", evt);
            this.clocks[0].connecting = false;
            this.clocks[1].connecting = false;
            this.doSend({ type: "game_user_connected", username: this.model["username"], gameId: this.model["gameId"] });
        };

        const opts = {
            maxAttempts: 10,
            onopen: e => onOpen(e),
            onmessage: e => this.onMessage(e),
            onreconnect: e => {
                this.clocks[0].connecting = true;
                this.clocks[1].connecting = true;
                console.log('Reconnecting in round...', e);

                const container = document.getElementById('player1') as HTMLElement;
                patch(container, h('i-side.online#player1', {class: {"icon": true, "icon-online": false, "icon-offline": true}}));
                },
            onmaximum: e => console.log('Stop Attempting!', e),
            onclose: e => console.log('Closed!', e),
            onerror: e => console.log('Error:', e),
            };

        //const ws = (location.host.indexOf('pychess') === -1) ? 'ws://' : 'wss://';
        const ws = (location.host.indexOf('0.0.0.0') === -1) ? 'wss://' : 'ws://'
        this.sock = new Sockette(ws + location.host + "/wsr", opts);

        this.model = model;
        this.gameId = model["gameId"] as string;
        this.variant = model["variant"];
        this.fullfen = model["fen"];
        this.wplayer = model["wplayer"];
        this.bplayer = model["bplayer"];
        this.base = Number(model["base"]);
        this.inc = Number(model["inc"]);
        this.byoyomiPeriod = Number(model["byo"]);
        this.byoyomi = isVariantClass(this.variant, 'byoyomi');
        this.status = Number(model["status"]);
        this.tv = model["tv"];
        this.steps = [];
        this.pgn = "";
        this.ply = -1;

        this.flip = false;
        this.settings = true;
        this.clickDropEnabled = true;
        this.animation = localStorage.animation === undefined ? true : localStorage.animation === "true";
        this.showDests = localStorage.showDests === undefined ? true : localStorage.showDests === "true";
        this.blindfold = localStorage.blindfold === undefined ? false : localStorage.blindfold === "true";
        this.autoqueen = localStorage.autoqueen === undefined ? false : localStorage.autoqueen === "true";

        this.spectator = this.model["username"] !== this.wplayer && this.model["username"] !== this.bplayer;
        this.hasPockets = isVariantClass(this.variant, 'pocket');
        this.handicap = VARIANTS[this.variant].alternateStart ? Object.keys(VARIANTS[this.variant].alternateStart!).some(alt => isHandicap(alt) && VARIANTS[this.variant].alternateStart![alt] === this.fullfen) : false;

        this.hasCommittedGates = isVariantClass(this.variant, 'commitGates');

        console.log('roundctrl');
        console.log(this.hasCommittedGates);

        // orientation = this.mycolor
        if (this.spectator) {
            this.mycolor = 'white';
            this.oppcolor = 'black';
        } else {
            this.mycolor = this.model["username"] === this.wplayer ? 'white' : 'black';
            this.oppcolor = this.model["username"] === this.wplayer ? 'black' : 'white';
        }

        // players[0] is top player, players[1] is bottom player
        this.players = [
            this.mycolor === "white" ? this.bplayer : this.wplayer,
            this.mycolor === "white" ? this.wplayer : this.bplayer
        ];
        this.titles = [
            this.mycolor === "white" ? this.model['btitle'] : this.model['wtitle'],
            this.mycolor === "white" ? this.model['wtitle'] : this.model['btitle']
        ];
        this.ratings = [
            this.mycolor === "white" ? this.model['brating'] : this.model['wrating'],
            this.mycolor === "white" ? this.model['wrating'] : this.model['brating']
        ];

        this.premove = null;
        this.predrop = null;
        this.preaction = false;

        this.result = "";
        const parts = this.fullfen.split(" ");
        this.abortable = Number(parts[parts.length - 1]) <= 1;

        var fen_placement = parts[0];
        if(this.hasCommittedGates){
            const mfen = splitMusketeerFen(fen_placement);
            fen_placement = mfen[0];
            this.committedGates = [Array<string>(8), Array<string>(8)];
            this.setCommittedGate(0, mfen[1]);
            this.setCommittedGate(1, mfen[2]);
        }

        this.turnColor = parts[1] === "w" ? "white" : "black";

        this.steps.push({
            'fen': this.fullfen,
            'move': undefined,
            'check': false,
            'turnColor': this.turnColor,
            });

        this.chessground = Chessground(el, {
            fen: fen_placement,
            variant: this.variant as Variant,
            geometry: VARIANTS[this.variant].geometry,
            notation: (this.variant === 'janggi') ? Notation.JANGGI : Notation.DEFAULT,
            orientation: this.mycolor,
            turnColor: this.turnColor,
            autoCastle: this.variant !== 'cambodian',
            animation: { enabled: this.animation },
        });

        if (this.spectator) {
            this.chessground.set({
                //viewOnly: false,
                movable: { free: false },
                draggable: { enabled: false },
                premovable: { enabled: false },
                predroppable: { enabled: false },
                events: { move: this.onMove() }
            });
        } else {
            this.chessground.set({
                animation: { enabled: this.animation },
                movable: {
                    free: false,
                    color: this.mycolor,
                    showDests: this.showDests,
                    events: {
                        after: this.onUserMove,
                        afterNewPiece: this.onUserDrop,
                    }
                },
                premovable: {
                    enabled: true,
                    events: {
                        set: this.setPremove,
                        unset: this.unsetPremove,
                        }
                },
                predroppable: {
                    enabled: true,
                    events: {
                        set: this.setPredrop,
                        unset: this.unsetPredrop,
                        }
                },
                events: {
                    move: this.onMove(),
                    dropNewPiece: this.onDrop(),
                    select: this.onSelect(),
                }
            });
        }

        this.gating = new Gating(this);
        this.promotion = new Promotion(this);

        // initialize users
        const player0 = document.getElementById('rplayer0') as HTMLElement;
        const player1 = document.getElementById('rplayer1') as HTMLElement;
        this.vplayer0 = patch(player0, player('player0', this.titles[0], this.players[0], this.ratings[0], model["level"]));
        this.vplayer1 = patch(player1, player('player1', this.titles[1], this.players[1], this.ratings[1], model["level"]));

        // initialize pockets
        if (this.hasPockets) {
            const pocket0 = document.getElementById('pocket0') as HTMLElement;
            const pocket1 = document.getElementById('pocket1') as HTMLElement;
            updatePockets(this, pocket0, pocket1);
        }

        // initialize committed gates
        if(this.hasCommittedGates){
            const gate0 = document.getElementById('gate0') as HTMLElement;
            const gate1 = document.getElementById('gate1') as HTMLElement;
            updateCommittedGates(this, gate0, gate1);
        }

        // initialize clocks
        this.clocktimes = {};
        const c0 = new Clock(this.base, this.inc, this.byoyomiPeriod, document.getElementById('clock0') as HTMLElement, 'clock0');
        const c1 = new Clock(this.base, this.inc, this.byoyomiPeriod, document.getElementById('clock1') as HTMLElement, 'clock1');
        this.clocks = [c0, c1];
        this.clocks[0].onTick(this.clocks[0].renderTime);
        this.clocks[1].onTick(this.clocks[1].renderTime);

        const onMoreTime = () => {
            // TODO: enable when this.flip is true
            if (this.model['wtitle'] === 'BOT' || this.model['btitle'] === 'BOT' || this.spectator || this.status >= 0 || this.flip) return;
            this.clocks[0].setTime(this.clocks[0].duration + 15 * 1000);
            this.doSend({ type: "moretime", gameId: this.gameId });
            const oppName = (this.model["username"] === this.wplayer) ? this.bplayer : this.wplayer;
            chatMessage('', oppName + _(' +15 seconds'), "roundchat");
        }

        if (!this.spectator && model["rated"] != '1' && this.model['wtitle'] !== 'BOT' && this.model['btitle'] !== 'BOT') {
            const container = document.getElementById('more-time') as HTMLElement;
            patch(container, h('div#more-time', [
                h('button.icon.icon-plus-square', {
                    props: {type: "button", title: _("Give 15 seconds")},
                    on: { click: () => onMoreTime() }
                })
            ]));
        }

        // initialize crosstable
        this.ctableContainer = document.getElementById('ctable-container') as HTMLElement;

        const misc0 = document.getElementById('misc-info0') as HTMLElement;
        const misc1 = document.getElementById('misc-info1') as HTMLElement;

        // initialize material point and counting indicator
        if (isVariantClass(this.variant, 'showMaterialPoint') || isVariantClass(this.variant, 'showCount')) {
            this.vmiscInfoW = this.mycolor === 'white' ? patch(misc1, h('div#misc-infow')) : patch(misc0, h('div#misc-infow'));
            this.vmiscInfoB = this.mycolor === 'black' ? patch(misc1, h('div#misc-infob')) : patch(misc0, h('div#misc-infob'));
        }

        const resultEl = document.getElementById('result') as HTMLElement;
        resultEl.style.display = 'none';

        const flagCallback = () => {
            if (this.turnColor === this.mycolor) {
                this.chessground.stop();
                // console.log("Flag");
                this.doSend({ type: "flag", gameId: this.gameId });
            }
        }

        const byoyomiCallback = () => {
            if (this.turnColor === this.mycolor) {
                // console.log("Byoyomi", this.clocks[1].byoyomiPeriod);
                const oppclock = !this.flip ? 0 : 1;
                const myclock = 1 - oppclock;
                this.doSend({ type: "byoyomi", gameId: this.gameId, color: this.mycolor, period: this.clocks[myclock].byoyomiPeriod });
            }
        }

        if (!this.spectator) {
            if (this.byoyomiPeriod > 0) {
                this.clocks[1].onByoyomi(byoyomiCallback);
            }
            this.clocks[1].onFlag(flagCallback);
        }

        const container = document.getElementById('game-controls') as HTMLElement;
        if (!this.spectator) {
            const pass = isVariantClass(this.variant, 'pass');
            this.gameControls = patch(container, h('div.btn-controls', [
                h('button#abort', { on: { click: () => this.abort() }, props: {title: _('Abort')} }, [h('i', {class: {"icon": true, "icon-abort": true} } ), ]),
                h('button#count', _('Count')),
                h('button#draw', { on: { click: () => (pass) ? this.pass() : this.draw() }, props: {title: (pass) ? _('Pass') : _("Draw")} }, [(pass) ? _('Pass') : h('i', {class: {"icon": true, "icon-hand-paper-o": true} } ), ]),
                h('button#resign', { on: { click: () => this.resign() }, props: {title: _("Resign")} }, [h('i', {class: {"icon": true, "icon-flag-o": true} } ), ]),
            ]));

            const manualCount = isVariantClass(this.variant, 'manualCount') && !(this.model['wtitle'] === 'BOT' || this.model['btitle'] === 'BOT');
            if (!manualCount)
                patch(document.getElementById('count') as HTMLElement, h('div'));

        } else {
            this.gameControls = patch(container, h('div'));
        }

        createMovelistButtons(this);
        this.vmovelist = document.getElementById('movelist') as HTMLElement;

        patch(document.getElementById('roundchat') as HTMLElement, chatView(this, "roundchat"));

        boardSettings.ctrl = this;
        const boardFamily = VARIANTS[this.variant].board;
        const pieceFamily = VARIANTS[this.variant].piece;
        boardSettings.updateBoardStyle(boardFamily);
        boardSettings.updatePieceStyle(pieceFamily);
        boardSettings.updateZoom(boardFamily);
        boardSettings.updateBlindfold();
    }

    private setCommittedGate(idx: number, gateString: string){
        console.log("setCommittedGate for idx: "+idx+", string: "+gateString);
        // maybe check gate lengths are correct and equal
        for(var i = 0; i < gateString.length; i++){
            var letter = gateString[i].toLowerCase();
            //console.log(i+" "+letter);
            if(letter != '*' && rolesVariants[letter] != undefined) this.committedGates[idx][i] = rolesVariants[letter];
            else this.committedGates[idx][i] = '*';
        }
        //var abc = this.committedGates[0].join('') + ' ' + this.committedGates[1].join('');
        //patch(document.getElementById('debugspace') as HTMLElement, h('span', abc));
    }

    getGround = () => this.chessground;

    private abort = () => {
        // console.log("Abort");
        this.doSend({ type: "abort", gameId: this.gameId });
    }

    private draw = () => {
        // console.log("Draw");
        this.doSend({ type: "draw", gameId: this.gameId });
    }

    private resign = () => {
        // console.log("Resign");
        if (confirm(_('Are you sure you want to resign?'))) {
            this.doSend({ type: "resign", gameId: this.gameId });
        }
    }

    private pass = () => {
        let passKey = 'z0';
        const pieces = this.chessground.state.pieces;
        const dests = this.chessground.state.movable.dests;
        for (const key in pieces) {
            if (pieces[key]!.role === 'king' && pieces[key]!.color === this.turnColor) {
                if ((key in dests!) && (dests![key].indexOf(key as Key) >= 0)) passKey = key;
            }
        }
        if (passKey !== 'z0') {
            // prevent calling pass() again by selectSquare() -> onSelect()
            this.chessground.state.movable.dests = undefined;
            this.chessground.selectSquare(passKey as Key);
            sound.move();
            this.sendMove(passKey, passKey, '');
        }
    }

    // Janggi second player (Red) setup
    private onMsgSetup = (msg) => {
        this.setupFen = msg.fen;
        this.chessground.set({fen: this.setupFen});

        const side = (msg.color === 'white') ? _('Blue (Cho)') : _('Red (Han)');
        const message = _('Waiting for %1 to choose starting positions of the horses and elephants...', side);

        if (this.spectator || msg.color !== this.mycolor) {
            chatMessage('', message, "roundchat");
            return;
        }

        chatMessage('', message, "roundchat");

        const switchLetters = (side) => {
            const white = this.mycolor === 'white';
            const rank = (white) ? 9 : 0;
            const horse = (white) ? 'N' : 'n';
            const elephant = (white) ? 'B' : 'b';
            const parts = this.setupFen.split(' ')[0].split('/');
            let [left, right] = parts[rank].split('1')
            if (side === -1) {
                left = left.replace(horse, '*').replace(elephant, horse).replace('*', elephant);
            } else {
                right = right.replace(horse, '*').replace(elephant, horse).replace('*', elephant);
            }
            parts[rank] = left + '1' + right;
            this.setupFen = parts.join('/') + ' w - - 0 1' ;
            this.chessground.set({fen: this.setupFen});
        }

        const sendSetup = () => {
            patch(document.getElementById('janggi-setup-buttons') as HTMLElement, h('div#empty'));
            this.doSend({ type: "setup", gameId: this.gameId, color: this.mycolor, fen: this.setupFen });
        }

        const leftSide = (this.mycolor === 'white') ? -1 : 1;
        const rightSide = leftSide * -1;
        patch(document.getElementById('janggi-setup-buttons') as HTMLElement, h('div#janggi-setup-buttons', [
            h('button#flipLeft', { on: { click: () => switchLetters(leftSide) } }, [h('i', {props: {title: _('Switch pieces')}, class: {"icon": true, "icon-exchange": true} } ), ]),
            h('button', { on: { click: () => sendSetup() } }, [h('i', {props: {title: _('Ready')}, class: {"icon": true, "icon-check": true} } ), ]),
            h('button#flipRight', { on: { click: () => switchLetters(rightSide) } }, [h('i', {props: {title: _('Switch pieces')}, class: {"icon": true, "icon-exchange": true} } ), ]),
        ]));
    }

    // Musketeer prelude phase
    private onMsgPrelude = (msg) => {
        this.fullfen = msg.fen
        const parts = msg.fen.split(" ");
        var fen_board = parts[0];
        const mfen = splitMusketeerFen(fen_board);
        fen_board = mfen[0];
        if(this.hasCommittedGates){
            console.log("set committed gates (onmsgboard)");
            this.setCommittedGate(0, mfen[1]);
            this.setCommittedGate(1, mfen[2]);
        }
        this.dests = msg.dests
        this.turnColor = msg.color
        console.log("msgprelude")
        console.log(msg)
        console.log(this.dests);
        console.log("this.turnColor: "+this.turnColor);
        console.log("this.mycolor: "+this.mycolor);
        this.chessground.set({
            fen: fen_board,
            turnColor: this.turnColor,
            movable: {
                free: false,
                color: this.mycolor,
                dests: this.dests, //
            },
        });
        updateCommittedGates(this, this.vgate0, this.vgate1);
        // todo: lobby message
    }

    private onMsgGameStart = (msg) => {
        // console.log("got gameStart msg:", msg);
        if (msg.gameId !== this.gameId) return;
        if (!this.spectator) sound.genericNotify();
    }

    private onMsgNewGame = (msg) => {
        window.location.assign(this.model["home"] + '/' + msg["gameId"]);
    }

    private rematch = () => {
        this.doSend({ type: "rematch", gameId: this.gameId, handicap: this.handicap });
    }

    private newOpponent = (home) => {
        this.doSend({"type": "leave", "gameId": this.gameId});
        window.location.assign(home);
    }

    private analysis = (home) => {
        window.location.assign(home + '/' + this.gameId);
    }

    private gameOver = (rdiffs) => {
        let container = document.getElementById('result') as HTMLElement;
        patch(container, h('div#result', result(this.variant, this.status, this.result)));
        container.style.display = 'block';

        container = document.getElementById('wrdiff') as HTMLElement;
        patch(container, renderRdiff(rdiffs["wrdiff"]));

        container = document.getElementById('brdiff') as HTMLElement;
        patch(container, renderRdiff(rdiffs["brdiff"]));

        // console.log(rdiffs)
        if (!this.spectator) {
            this.gameControls = patch(this.gameControls, h('div'));
            patch(this.gameControls, h('div#after-game-controls', [
                h('button.rematch', { on: { click: () => this.rematch() } }, _("REMATCH")),
                h('button.newopp', { on: { click: () => this.newOpponent(this.model["home"]) } }, _("NEW OPPONENT")),
                h('button.analysis', { on: { click: () => this.analysis(this.model["home"]) } }, _("ANALYSIS BOARD")),
            ]));
        }
    }

    private checkStatus = (msg) => {
        if (msg.gameId !== this.gameId) return;
        if (msg.status >= 0 && this.result === "") {
            this.clocks[0].pause(false);
            this.clocks[1].pause(false);
            this.result = msg.result;
            this.status = msg.status;
            if (!this.spectator) {
                switch (msg.result) {
                case "1/2-1/2":
                    sound.draw();
                    break;
                case "1-0":
                    if (!this.spectator) {
                        if (this.mycolor === "white") {
                            sound.victory();
                        } else {
                            sound.defeat();
                        }
                    }
                    break;
                case "0-1":
                    if (!this.spectator) {
                        if (this.mycolor === "black") {
                            sound.victory();
                        } else {
                            sound.defeat();
                        }
                    }
                    break;
                // ABORTED
                default:
                    break;
                }
            }
            this.gameOver(msg.rdiffs);
            selectMove(this, this.ply);

            if (msg.ct !== "") {
                this.ctableContainer = patch(this.ctableContainer, h('div#ctable-container'));
                this.ctableContainer = patch(this.ctableContainer, crosstableView(msg.ct, this.gameId));
            }

            // clean up gating/promotion widget left over the ground while game ended by time out
            const container = document.getElementById('extension_choice') as HTMLElement;
            if (container instanceof Element) patch(container, h('extension'));

            if (this.tv) {
                setInterval(() => {this.doSend({ type: "updateTV", gameId: this.gameId, profileId: this.model["profileid"] });}, 2000);
            }
        }
    }

    private onMsgUpdateTV = (msg) => {
        if (msg.gameId !== this.gameId) {
            if (this.model["profileid"] !== "") {
                window.location.assign(this.model["home"] + '/@/' + this.model["profileid"] + '/tv');
            } else {
                window.location.assign(this.model["home"] + '/tv');
            }
            // TODO: reuse current websocket to fix https://github.com/gbtami/pychess-variants/issues/142
            // this.doSend({ type: "game_user_connected", username: this.model["username"], gameId: msg.gameId });
        }
    }

    private onMsgBoard = (msg) => {
        console.log("onMsgBoard: "+msg)
        if (msg.gameId !== this.gameId) return;

        // prevent sending premove/predrop when (auto)reconnecting websocked asks server to (re)sends the same board to us
        if (!this.spectator && msg.ply === this.ply) return;
        const pocketsChanged = this.hasPockets && (getPockets(this.fullfen) !== getPockets(msg.fen));

        // console.log("got board msg:", msg);
        const latestPly = (this.ply === -1 || msg.ply === this.ply + 1);
        if (latestPly) this.ply = msg.ply

        this.fullfen = msg.fen;

        if (isVariantClass(this.variant, 'gate')) {
            // When castling with gating is possible
            // e1g1, e1g1h, e1g1e, h1e1h, h1e1e all will be offered by moving our king two squares
            // so we filter out rook takes king moves (h1e1h, h1e1e) from dests
            for (const orig of Object.keys(msg.dests)) {
                const movingPiece = this.chessground.state.pieces[orig];
                if (movingPiece !== undefined && movingPiece.role === "rook") {
                    msg.dests[orig] = msg.dests[orig].filter(x => {
                        const destPiece = this.chessground.state.pieces[x];
                        return destPiece === undefined || destPiece.role !== 'king';
                    });
                }
            }
        }

        this.dests = msg.dests;
        // list of legal promotion moves
        this.promotions = msg.promo;
        this.clocktimes = msg.clocks;

        const parts = msg.fen.split(" ");
        var fen_board = parts[0];

        if(isVariantClass(this.variant, 'commitGates')){
            updateCommittedGates(this, this.vgate0, this.vgate1);
            const mfen = splitMusketeerFen(fen_board);
            fen_board = mfen[0];
            if(this.hasCommittedGates){
                console.log("set committed gates (onmsgboard)");
                this.setCommittedGate(0, mfen[1]);
                this.setCommittedGate(1, mfen[2]);
            }
        }

        this.turnColor = parts[1] === "w" ? "white" : "black";

        if (msg.steps.length > 1) {
            this.steps = [];
            const container = document.getElementById('movelist') as HTMLElement;
            patch(container, h('div#movelist'));

            msg.steps.forEach((step) => {
                this.steps.push(step);
                });
            updateMovelist(this);
        } else {
            if (msg.ply === this.steps.length) {
                const step = {
                    'fen': msg.fen,
                    'move': msg.lastMove,
                    'check': msg.check,
                    'turnColor': this.turnColor,
                    'san': msg.steps[0].san,
                    };
                this.steps.push(step);
                const full = false;
                const activate = !this.spectator || latestPly;
                updateMovelist(this, full, activate);
            }
        }

        this.abortable = Number(msg.ply) <= 1;
        if (!this.spectator && !this.abortable && this.result === "") {
            const container = document.getElementById('abort') as HTMLElement;
            patch(container, h('button#abort', { props: {disabled: true} }));
        }

        let lastMove = msg.lastMove;
        if (lastMove !== null) {
            if (isVariantClass(this.variant, 'tenRanks')) {
                lastMove = grand2zero(lastMove);
            }
            // drop lastMove causing scrollbar flicker,
            // so we remove from part to avoid that
            lastMove = lastMove.indexOf('@') > -1 ? [lastMove.slice(-2)] : [lastMove.slice(0, 2), lastMove.slice(2, 4)];
        }
        // save capture state before updating chessground
        // 960 king takes rook castling is not capture
        const step = this.steps[this.steps.length - 1];
        let capture = false;
        if (step.san !== undefined) {
            capture = (lastMove !== null) && ((this.chessground.state.pieces[lastMove[1]] && step.san.slice(0, 2) !== 'O-') || (step.san.slice(1, 2) === 'x'));
        }
        // console.log("CAPTURE ?", capture, lastMove, step);
        if (lastMove !== null && (this.turnColor === this.mycolor || this.spectator)) {
            if (isVariantClass(this.variant, 'shogiSound')) {
                if (capture) {
                    sound.shogicapture();
                } else {
                    sound.shogimove();
                }
            } else {
                if (capture) {
                    sound.capture();
                } else {
                    sound.move();
                }
            }
        } else {
            lastMove = [];
        }
        this.checkStatus(msg);
        if (!this.spectator && msg.check) {
            sound.check();
        }

        if (isVariantClass(this.variant, 'showCount')) {
            this.updateCount(msg.fen);
        }

        if (isVariantClass(this.variant, 'showMaterialPoint')) {
            this.updatePoint(msg.fen);
        }

        const oppclock = !this.flip ? 0 : 1;
        const myclock = 1 - oppclock;

        this.clocks[0].pause(false);
        this.clocks[1].pause(false);
        if (this.byoyomi) {
            this.clocks[oppclock].byoyomiPeriod = msg.byo[(this.oppcolor == 'white') ? 0 : 1];
            this.clocks[myclock].byoyomiPeriod = msg.byo[(this.mycolor == 'white') ? 0 : 1];
        }
        this.clocks[oppclock].setTime(this.clocktimes[this.oppcolor]);
        this.clocks[myclock].setTime(this.clocktimes[this.mycolor]);

        if (this.spectator) {
            if (!this.abortable && msg.status < 0) {
                if (this.turnColor === this.mycolor) {
                    this.clocks[myclock].start();
                } else {
                    this.clocks[oppclock].start();
                }
            }
            if (latestPly) {
                this.chessground.set({
                    fen: fen_board,
                    turnColor: this.turnColor,
                    check: msg.check,
                    lastMove: lastMove,
                });
                if (pocketsChanged) updatePockets(this, this.vpocket0, this.vpocket1);
            }
        } else {
            if (this.turnColor === this.mycolor) {
                if (!this.abortable && msg.status < 0) {
                    this.clocks[myclock].start();
                    // console.log('MY CLOCK STARTED');
                }
                if (latestPly) {
                    this.chessground.set({
                        fen: fen_board,
                        turnColor: this.turnColor,
                        movable: {
                            free: false,
                            color: this.mycolor,
                            dests: this.dests,
                        },
                        check: msg.check,
                        lastMove: lastMove,
                    });
                    if (pocketsChanged) updatePockets(this, this.vpocket0, this.vpocket1);

                    // console.log("trying to play premove....");
                    if (this.premove) this.performPremove();
                    if (this.predrop) this.performPredrop();
                }
            } else {
                if (!this.abortable && msg.status < 0) {
                    this.clocks[oppclock].start();
                    // console.log('OPP CLOCK  STARTED');
                }
                this.chessground.set({
                    // giving fen here will place castling rooks to their destination in chess960 variants
                    fen: fen_board,
                    turnColor: this.turnColor,
                    check: msg.check,
                });
            }
        };
    }

    goPly = (ply) => {
        const step = this.steps[ply];
        let move = step['move'];
        let capture = false;
        if (move !== undefined) {
            if (isVariantClass(this.variant, 'tenRanks')) move = grand2zero(move);
            move = move.indexOf('@') > -1 ? [move.slice(-2)] : [move.slice(0, 2), move.slice(2, 4)];
            // 960 king takes rook castling is not capture
            capture = (this.chessground.state.pieces[move[move.length - 1]] !== undefined && step.san.slice(0, 2) !== 'O-') || (step.san.slice(1, 2) === 'x');
        }
        this.fullfen = step.fen;
        const parts = step.fen.split(" ");
        var fen_board = parts[0];

        if(isVariantClass(this.variant, 'commitGates')){
            updateCommittedGates(this, this.vgate0, this.vgate1);
            const mfen = splitMusketeerFen(fen_board);
            fen_board = mfen[0];
            if(this.hasCommittedGates){
                console.log("set committed gates (onmsgboard)");
                this.setCommittedGate(0, mfen[1]);
                this.setCommittedGate(1, mfen[2]);
            }
        }

        this.chessground.set({
            fen: fen_board,
            turnColor: step.turnColor,
            movable: {
                free: false,
                color: this.spectator ? undefined : step.turnColor,
                dests: (this.turnColor === this.mycolor && this.result === "" && ply === this.steps.length - 1) ? this.dests : undefined,
                },
            check: step.check,
            lastMove: move,
        });

        updatePockets(this, this.vpocket0, this.vpocket1);

        if (isVariantClass(this.variant, 'showCount')) {
            this.updateCount(step.fen);
        }

        if (isVariantClass(this.variant, 'showMaterialPoint')) {
            this.updatePoint(step.fen);
        }

        if (ply === this.ply + 1) {
            if (isVariantClass(this.variant, 'shogiSound')) {
                if (capture) {
                    sound.shogicapture();
                } else {
                    sound.shogimove();
                }
            } else {
                if (capture) {
                    sound.capture();
                } else {
                    sound.move();
                }
            }
        }
        this.ply = ply
    }

    private doSend = (message: JSONObject) => {
        // console.log("---> doSend():", message);
        this.sock.send(JSON.stringify(message));
    }

    private sendMove = (orig, dest, promo) => {
        // pause() will add increment!
        const oppclock = !this.flip ? 0 : 1
        const myclock = 1 - oppclock;
        const movetime = (this.clocks[myclock].running) ? Date.now() - this.clocks[myclock].startTime : 0;
        this.clocks[myclock].pause((this.base === 0 && this.ply < 2) ? false : true);
        // console.log("sendMove(orig, dest, prom)", orig, dest, promo);

        const uci_move = orig + dest + promo;
        const move = (isVariantClass(this.variant, 'tenRanks')) ? zero2grand(uci_move) : uci_move;

        // console.log("sendMove(move)", move);
        let bclock, clocks;
        if (!this.flip) {
            bclock = this.mycolor === "black" ? 1 : 0;
        } else {
            bclock = this.mycolor === "black" ? 0 : 1;
        }
        const wclock = 1 - bclock

        const increment = (this.inc > 0 && this.ply >= 2 && !this.byoyomi) ? this.inc * 1000 : 0;

        const bclocktime = (this.mycolor === "black" && this.preaction) ? this.clocktimes.black + increment: this.clocks[bclock].duration;
        const wclocktime = (this.mycolor === "white" && this.preaction) ? this.clocktimes.white + increment: this.clocks[wclock].duration;

        clocks = {movetime: (this.preaction) ? 0 : movetime, black: bclocktime, white: wclocktime};

        this.doSend({ type: "move", gameId: this.gameId, move: move, clocks: clocks, ply: this.ply + 1 });

        if (!this.abortable) this.clocks[oppclock].start();
    }

    private startCount = () => {
        this.doSend({ type: "count", gameId: this.gameId, mode: "start" });
    }

    private stopCount = () => {
        this.doSend({ type: "count", gameId: this.gameId, mode: "stop" });
    }

    private updateCount = (fen) => {
        [this.vmiscInfoW, this.vmiscInfoB] = updateCount(fen, this.vmiscInfoW, this.vmiscInfoB);
        const countButton = document.getElementById('count') as HTMLElement;
        if (countButton) {
            const [ , , countingSide, countingType ] = getCounting(fen);
            const myturn = this.mycolor === this.turnColor;
            if (countingType === 'board')
                if ((countingSide === 'w' && this.mycolor === 'white') || (countingSide === 'b' && this.mycolor === 'black'))
                    patch(countButton, h('button#count', { on: { click: () => this.stopCount() }, props: {title: _('Stop counting')}, class: { disabled: !myturn } }, _('Stop')));
                else
                    patch(countButton, h('button#count', { on: { click: () => this.startCount() }, props: {title: _('Start counting')}, class: { disabled: !(myturn && countingSide === '') } }, _('Count')));
            else
                patch(countButton, h('button#count', { props: {title: _('Start counting')}, class: { disabled: true } }, _('Count')));
        }
    }

    private updatePoint = (fen) => {
        [this.vmiscInfoW, this.vmiscInfoB] = updatePoint(fen, this.vmiscInfoW, this.vmiscInfoB);
    }

    private onMove = () => {
        return (orig, dest, capturedPiece) => {
            console.log("   ground.onMove()", orig, dest, capturedPiece);
            if (isVariantClass(this.variant, 'shogiSound')) {
                if (capturedPiece) {
                    sound.shogicapture();
                } else {
                    sound.shogimove();
                }
            } else {
                if (capturedPiece) {
                    sound.capture();
                } else {
                    sound.move();
                }
            }
        }
    }

    private onDrop = () => {
        return (piece, dest) => {
            // console.log("ground.onDrop()", piece, dest);
            if (dest != 'z0' && piece.role && dropIsValid(this.dests, piece.role, dest)) {
                if (isVariantClass(this.variant, 'shogiSound')) {
                    sound.shogimove();
                } else {
                    sound.move();
                }
            } else if (this.clickDropEnabled) {
                this.clickDrop = piece;
            }
        }
    }

    private setPremove = (orig: Key, dest: Key, metadata?: SetPremoveMetadata) => {
        this.premove = { orig, dest, metadata };
        // console.log("setPremove() to:", orig, dest, meta);
    }

    private unsetPremove = () => {
        this.premove = null;
        this.preaction = false;
    }

    private setPredrop = (role: Role, key: Key) => {
        this.predrop = { role, key };
        // console.log("setPredrop() to:", role, key);
    }

    private unsetPredrop = () => {
        this.predrop = null;
        this.preaction = false;
    }

    private performPremove = () => {
        // const { orig, dest, meta } = this.premove;
        // TODO: promotion?
        // console.log("performPremove()", orig, dest, meta);
        this.chessground.playPremove();
        this.premove = null;
    }

    private performPredrop = () => {
        // const { role, key } = this.predrop;
        // console.log("performPredrop()", role, key);
        this.chessground.playPredrop(drop => { return dropIsValid(this.dests, drop.role, drop.key); });
        this.predrop = null;
    }

    private onUserMove = (orig, dest, meta) => {
        this.preaction = meta.premove === true;
        // chessground doesn't knows about ep, so we have to remove ep captured pawn
        const pieces = this.chessground.state.pieces;
        const geom = this.chessground.state.geometry;
        // console.log("ground.onUserMove()", orig, dest, meta);
        let moved = pieces[dest];
        // Fix king to rook 960 castling case
        if (moved === undefined) moved = {role: 'king', color: this.mycolor} as Piece;
        const firstRankIs0 = this.chessground.state.dimensions.height === 10;
        if (meta.captured === undefined && moved !== undefined && moved.role === "pawn" && orig[0] != dest[0] && isVariantClass(this.variant, 'enPassant')) {
            const pos = key2pos(dest, firstRankIs0),
            pawnPos: Pos = [pos[0], pos[1] + (this.mycolor === 'white' ? -1 : 1)];
            const diff: PiecesDiff = {};
            diff[pos2key(pawnPos, geom)] = undefined;
            this.chessground.setPieces(diff);
            meta.captured = {role: "pawn"};
        }
        // increase pocket count
        if (isVariantClass(this.variant, 'drop') && meta.captured) {
            let role = meta.captured.role
            if (meta.captured.promoted) role = (this.variant.endsWith('shogi') || this.variant === 'shogun' || this.variant === 'dobutsu') ? meta.captured.role.slice(1) as Role : "pawn";

            let position = (this.turnColor === this.mycolor) ? "bottom": "top";
            if (this.flip) position = (position === "top") ? "bottom" : "top";
            if (position === "top") {
                this.pockets[0][role]++;
                this.vpocket0 = patch(this.vpocket0, pocketView(this, this.turnColor, "top"));
            } else {
                this.pockets[1][role]++;
                this.vpocket1 = patch(this.vpocket1, pocketView(this, this.turnColor, "bottom"));
            }
        }

        if(isVariantClass(this.variant, 'commitGates')){
            updateCommittedGates(this, this.vgate0, this.vgate1);
        }

        //  gating elephant/hawk
        if (isVariantClass(this.variant, 'gate')) {
            if (!this.promotion.start(moved.role, orig, dest) && !this.gating.start(this.fullfen, orig, dest)) this.sendMove(orig, dest, '');
        } else {
            if (!this.promotion.start(moved.role, orig, dest)) this.sendMove(orig, dest, '');
        this.preaction = false;
        }
    }

    private onUserDrop = (role, dest, meta) => {
        this.preaction = meta.predrop === true;
        // console.log("ground.onUserDrop()", role, dest, meta);
        // decrease pocket count
        if (dropIsValid(this.dests, role, dest)) {
            let position = (this.turnColor === this.mycolor) ? "bottom": "top";
            if (this.flip) position = (position === "top") ? "bottom" : "top";
            if (position === "top") {
                this.pockets[0][role]--;
                this.vpocket0 = patch(this.vpocket0, pocketView(this, this.turnColor, "top"));
            } else {
                this.pockets[1][role]--;
                this.vpocket1 = patch(this.vpocket1, pocketView(this, this.turnColor, "bottom"));
            }
            if (this.variant === "kyotoshogi") {
                if (!this.promotion.start(role, 'z0', dest)) this.sendMove(roleToSan[role] + "@", dest, '');
            } else {
                this.sendMove(roleToSan[role] + "@", dest, '')
            }
            // console.log("sent move", move);
        } else {
            // console.log("!!! invalid move !!!", role, dest);
            // restore board
            this.clickDrop = undefined;
            this.chessground.set({
                fen: this.fullfen,
                lastMove: this.lastmove,
                turnColor: this.mycolor,
                animation: { enabled: this.animation },
                movable: {
                    dests: this.dests,
                    showDests: this.showDests,
                    },
                }
            );
        }
        this.preaction = false;
    }

    private onSelect = () => {
        return (key) => {
            if (this.chessground.state.movable.dests === undefined) return;

            // If drop selection was set dropDests we have to restore dests here
            if (key != 'z0' && 'z0' in this.chessground.state.movable.dests) {
                if (this.clickDropEnabled && this.clickDrop !== undefined && dropIsValid(this.dests, this.clickDrop.role, key)) {
                    this.chessground.newPiece(this.clickDrop, key);
                    this.onUserDrop(this.clickDrop.role, key, {predrop: this.predrop});
                }
                this.clickDrop = undefined;
                //cancelDropMode(this.chessground.state);
                this.chessground.set({ movable: { dests: this.dests }});
            }

            // Save state.pieces to help recognise 960 castling (king takes rook) moves
            // Shouldn't this be implemented in chessground instead?
            if (this.model.chess960 === 'True' && isVariantClass(this.variant, 'gate')) {
                this.prevPieces = Object.assign({}, this.chessground.state.pieces);
            }

            // Janggi pass and Sittuyin in place promotion on Ctrl+click
            if (this.chessground.state.stats.ctrlKey &&
                (key in this.chessground.state.movable.dests) &&
                (this.chessground.state.movable.dests[key].indexOf(key) >= 0)
                ) {
                const piece = this.chessground.state.pieces[key];
                if (this.variant === 'sittuyin') {
                    // console.log("Ctrl in place promotion", key);
                    const pieces = {};
                    pieces[key] = {
                        color: piece!.color,
                        role: 'ferz',
                        promoted: true
                    };
                    this.chessground.setPieces(pieces);
                    this.sendMove(key, key, 'f');
                } else if (isVariantClass(this.variant, 'pass') && piece!.role === 'king') {
                    this.pass();
                }
            }
        }
    }

    private onMsgUserConnected = (msg) => {
        this.model["username"] = msg["username"];
        if (this.spectator) {
            this.doSend({ type: "is_user_present", username: this.wplayer, gameId: this.gameId });
            this.doSend({ type: "is_user_present", username: this.bplayer, gameId: this.gameId });

            // we want to know lastMove and check status
            this.doSend({ type: "board", gameId: this.gameId });
        } else {
            const opp_name = this.model["username"] === this.wplayer ? this.bplayer : this.wplayer;
            this.doSend({ type: "is_user_present", username: opp_name, gameId: this.gameId });

            const container = document.getElementById('player1') as HTMLElement;
            patch(container, h('i-side.online#player1', {class: {"icon": true, "icon-online": true, "icon-offline": false}}));

            // prevent sending gameStart message when user just reconecting
            if (msg.ply === 0) {
                this.doSend({ type: "ready", gameId: this.gameId });
            }
            this.doSend({ type: "board", gameId: this.gameId });
        }
    }

    private onMsgSpectators = (msg) => {
        const container = document.getElementById('spectators') as HTMLElement;
        patch(container, h('under-left#spectators', _('Spectators: ') + msg.spectators));
    }

    private onMsgUserPresent = (msg) => {
        // console.log(msg);
        if (msg.username === this.players[0]) {
            const container = document.getElementById('player0') as HTMLElement;
            patch(container, h('i-side.online#player0', {class: {"icon": true, "icon-online": true, "icon-offline": false}}));
        } else {
            const container = document.getElementById('player1') as HTMLElement;
            patch(container, h('i-side.online#player1', {class: {"icon": true, "icon-online": true, "icon-offline": false}}));
        }
    }

    private onMsgUserDisconnected = (msg) => {
        // console.log(msg);
        if (msg.username === this.players[0]) {
            const container = document.getElementById('player0') as HTMLElement;
            patch(container, h('i-side.online#player0', {class: {"icon": true, "icon-online": false, "icon-offline": true}}));
        } else {
            const container = document.getElementById('player1') as HTMLElement;
            patch(container, h('i-side.online#player1', {class: {"icon": true, "icon-online": false, "icon-offline": true}}));
        }
    }

    private onMsgChat = (msg) => {
        if ((this.spectator && msg.room === 'spectator') || (!this.spectator && msg.room !== 'spectator') || msg.user.length === 0) {
            chatMessage(msg.user, msg.message, "roundchat");
        }
    }

    private onMsgFullChat = (msg) => {
        // To prevent multiplication of messages we have to remove old messages div first
        patch(document.getElementById('messages') as HTMLElement, h('div#messages-clear'));
        // then create a new one
        patch(document.getElementById('messages-clear') as HTMLElement, h('div#messages'));
        msg.lines.forEach((line) => {
            if ((this.spectator && line.room === 'spectator') || (!this.spectator && line.room !== 'spectator') || line.user.length === 0) {
                chatMessage(line.user, line.message, "roundchat");
            }
        });
    }

    private onMsgMoreTime = (msg) => {
        chatMessage('', msg.username + _(' +15 seconds'), "roundchat");
        if (this.spectator) {
            if (msg.username === this.players[0]) {
                this.clocks[0].setTime(this.clocks[0].duration + 15 * 1000);
            } else {
                this.clocks[1].setTime(this.clocks[1].duration + 15 * 1000);
            }
        } else {
            this.clocks[1].setTime(this.clocks[1].duration + 15 * 1000);
        }
    }

    private onMsgOffer = (msg) => {
        chatMessage("", msg.message, "roundchat");
    }

    private onMsgGameNotFound = (msg) => {
        alert(_("Requested game %1 not found!", msg['gameId']));
        window.location.assign(this.model["home"]);
    }

    private onMsgShutdown = (msg) => {
        alert(msg.message);
    }

    private onMsgCtable = (ct, gameId) => {
        if (ct !== "") {
            this.ctableContainer = patch(this.ctableContainer, h('div#ctable-container'));
            this.ctableContainer = patch(this.ctableContainer, crosstableView(ct, gameId));
        }
    }

    private onMsgCount = (msg) => {
        chatMessage("", msg.message, "roundchat");
        if (msg.message.endsWith("started")) {
            if (this.turnColor === 'white')
                this.vmiscInfoW = patch(this.vmiscInfoW, h('div#count-white', '0/64'));
            else
                this.vmiscInfoB = patch(this.vmiscInfoB, h('div#count-black', '0/64'));
        }
        else if (msg.message.endsWith("stopped")) {
            if (this.turnColor === 'white')
                this.vmiscInfoW = patch(this.vmiscInfoW, h('div#count-white', ''));
            else
                this.vmiscInfoB = patch(this.vmiscInfoB, h('div#count-black', ''));
        }
    }

    private onMessage = (evt) => {
        console.log("<+++ onMessage():", evt.data);
        const msg = JSON.parse(evt.data);
        switch (msg.type) {
            case "board":
                this.onMsgBoard(msg);
                break;
            case "crosstable":
                this.onMsgCtable(msg.ct, this.gameId);
                break
            case "gameEnd":
                this.checkStatus(msg);
                break;
            case "gameStart":
                this.onMsgGameStart(msg);
                break;
            case "game_user_connected":
                this.onMsgUserConnected(msg);
                break;
            case "user_present":
                this.onMsgUserPresent(msg);
                break;
            case "spectators":
                this.onMsgSpectators(msg);
                break
            case "user_disconnected":
                this.onMsgUserDisconnected(msg);
                break;
            case "roundchat":
                this.onMsgChat(msg);
                break;
            case "fullchat":
                this.onMsgFullChat(msg);
                break;
            case "new_game":
                this.onMsgNewGame(msg);
                break;
            case "offer":
                this.onMsgOffer(msg);
                break;
            case "moretime":
                this.onMsgMoreTime(msg);
                break;
            case "updateTV":
                this.onMsgUpdateTV(msg);
                break
            case "game_not_found":
                this.onMsgGameNotFound(msg);
                break
            case "shutdown":
                this.onMsgShutdown(msg);
                break;
            case "logout":
                this.doSend({type: "logout"});
                break;
            case "setup":
                this.onMsgSetup(msg);
                break;
            case "prelude":
                this.onMsgPrelude(msg);
                break;
            case "count":
                this.onMsgCount(msg);
                break;
        }
    }
}
