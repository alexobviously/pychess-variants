(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.PychessVariants = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("./util");
function anim(mutation, state) {
    return state.animation.enabled ? animate(mutation, state) : render(mutation, state);
}
exports.anim = anim;
function render(mutation, state) {
    const result = mutation(state);
    state.dom.redraw();
    return result;
}
exports.render = render;
function makePiece(key, piece, firstRankIs0) {
    return {
        key: key,
        pos: util.key2pos(key, firstRankIs0),
        piece: piece
    };
}
function closer(piece, pieces) {
    return pieces.sort((p1, p2) => {
        return util.distanceSq(piece.pos, p1.pos) - util.distanceSq(piece.pos, p2.pos);
    })[0];
}
function computePlan(prevPieces, current) {
    const firstRankIs0 = current.dimensions.height === 10;
    const anims = {}, animedOrigs = [], fadings = {}, missings = [], news = [], prePieces = {};
    let curP, preP, i, vector;
    for (i in prevPieces) {
        prePieces[i] = makePiece(i, prevPieces[i], firstRankIs0);
    }
    for (const key of util.allKeys[current.geometry]) {
        curP = current.pieces[key];
        preP = prePieces[key];
        if (curP) {
            if (preP) {
                if (!util.samePiece(curP, preP.piece)) {
                    missings.push(preP);
                    news.push(makePiece(key, curP, firstRankIs0));
                }
            }
            else
                news.push(makePiece(key, curP, firstRankIs0));
        }
        else if (preP)
            missings.push(preP);
    }
    news.forEach(newP => {
        preP = closer(newP, missings.filter(p => util.samePiece(newP.piece, p.piece)));
        if (preP) {
            vector = [preP.pos[0] - newP.pos[0], preP.pos[1] - newP.pos[1]];
            anims[newP.key] = vector.concat(vector);
            animedOrigs.push(preP.key);
        }
    });
    missings.forEach(p => {
        if (!util.containsX(animedOrigs, p.key))
            fadings[p.key] = p.piece;
    });
    return {
        anims: anims,
        fadings: fadings
    };
}
function step(state, now) {
    const cur = state.animation.current;
    if (cur === undefined) {
        if (!state.dom.destroyed)
            state.dom.redrawNow();
        return;
    }
    const rest = 1 - (now - cur.start) * cur.frequency;
    if (rest <= 0) {
        state.animation.current = undefined;
        state.dom.redrawNow();
    }
    else {
        const ease = easing(rest);
        for (let i in cur.plan.anims) {
            const cfg = cur.plan.anims[i];
            cfg[2] = cfg[0] * ease;
            cfg[3] = cfg[1] * ease;
        }
        state.dom.redrawNow(true);
        requestAnimationFrame((now = performance.now()) => step(state, now));
    }
}
function animate(mutation, state) {
    const prevPieces = Object.assign({}, state.pieces);
    const result = mutation(state);
    const plan = computePlan(prevPieces, state);
    if (!isObjectEmpty(plan.anims) || !isObjectEmpty(plan.fadings)) {
        const alreadyRunning = state.animation.current && state.animation.current.start;
        state.animation.current = {
            start: performance.now(),
            frequency: 1 / state.animation.duration,
            plan: plan
        };
        if (!alreadyRunning)
            step(state, performance.now());
    }
    else {
        state.dom.redraw();
    }
    return result;
}
function isObjectEmpty(o) {
    for (let _ in o)
        return false;
    return true;
}
function easing(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

},{"./util":17}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board = require("./board");
const fen_1 = require("./fen");
const config_1 = require("./config");
const anim_1 = require("./anim");
const drag_1 = require("./drag");
const explosion_1 = require("./explosion");
function start(state, redrawAll) {
    function toggleOrientation() {
        board.toggleOrientation(state);
        redrawAll();
    }
    ;
    return {
        set(config) {
            if (config.orientation && config.orientation !== state.orientation)
                toggleOrientation();
            (config.fen ? anim_1.anim : anim_1.render)(state => config_1.configure(state, config), state);
        },
        state,
        getFen: () => fen_1.write(state.pieces, state.geometry),
        toggleOrientation,
        setPieces(pieces) {
            anim_1.anim(state => board.setPieces(state, pieces), state);
        },
        selectSquare(key, force) {
            if (key)
                anim_1.anim(state => board.selectSquare(state, key, force), state);
            else if (state.selected) {
                board.unselect(state);
                state.dom.redraw();
            }
        },
        move(orig, dest) {
            anim_1.anim(state => board.baseMove(state, orig, dest), state);
        },
        newPiece(piece, key) {
            anim_1.anim(state => board.baseNewPiece(state, piece, key), state);
        },
        playPremove() {
            if (state.premovable.current) {
                if (anim_1.anim(board.playPremove, state))
                    return true;
                state.dom.redraw();
            }
            return false;
        },
        playPredrop(validate) {
            if (state.predroppable.current) {
                const result = board.playPredrop(state, validate);
                state.dom.redraw();
                return result;
            }
            return false;
        },
        cancelPremove() {
            anim_1.render(board.unsetPremove, state);
        },
        cancelPredrop() {
            anim_1.render(board.unsetPredrop, state);
        },
        cancelMove() {
            anim_1.render(state => { board.cancelMove(state); drag_1.cancel(state); }, state);
        },
        stop() {
            anim_1.render(state => { board.stop(state); drag_1.cancel(state); }, state);
        },
        explode(keys) {
            explosion_1.default(state, keys);
        },
        setAutoShapes(shapes) {
            anim_1.render(state => state.drawable.autoShapes = shapes, state);
        },
        setShapes(shapes) {
            anim_1.render(state => state.drawable.shapes = shapes, state);
        },
        getKeyAtDomPos(pos) {
            return board.getKeyAtDomPos(pos, board.whitePov(state), state.dom.bounds(), state.geometry);
        },
        redrawAll,
        dragNewPiece(piece, event, force) {
            drag_1.dragNewPiece(state, piece, event, force);
        },
        destroy() {
            board.stop(state);
            state.dom.unbind && state.dom.unbind();
            state.dom.destroyed = true;
        }
    };
}
exports.start = start;

},{"./anim":1,"./board":3,"./config":5,"./drag":6,"./explosion":10,"./fen":11}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const premove_1 = require("./premove");
const cg = require("./types");
function callUserFunction(f, ...args) {
    if (f)
        setTimeout(() => f(...args), 1);
}
exports.callUserFunction = callUserFunction;
function toggleOrientation(state) {
    state.orientation = util_1.opposite(state.orientation);
    state.animation.current =
        state.draggable.current =
            state.selected = undefined;
}
exports.toggleOrientation = toggleOrientation;
function reset(state) {
    state.lastMove = undefined;
    unselect(state);
    unsetPremove(state);
    unsetPredrop(state);
}
exports.reset = reset;
function setPieces(state, pieces) {
    for (let key in pieces) {
        const piece = pieces[key];
        if (piece)
            state.pieces[key] = piece;
        else
            delete state.pieces[key];
    }
}
exports.setPieces = setPieces;
function setCheck(state, color) {
    state.check = undefined;
    if (color === true)
        color = state.turnColor;
    if (color)
        for (let k in state.pieces) {
            if (state.pieces[k].role === 'king' && state.pieces[k].color === color) {
                state.check = k;
            }
        }
}
exports.setCheck = setCheck;
function setPremove(state, orig, dest, meta) {
    unsetPredrop(state);
    state.premovable.current = [orig, dest];
    callUserFunction(state.premovable.events.set, orig, dest, meta);
}
function unsetPremove(state) {
    if (state.premovable.current) {
        state.premovable.current = undefined;
        callUserFunction(state.premovable.events.unset);
    }
}
exports.unsetPremove = unsetPremove;
function setPredrop(state, role, key) {
    unsetPremove(state);
    state.predroppable.current = { role, key };
    callUserFunction(state.predroppable.events.set, role, key);
}
function unsetPredrop(state) {
    const pd = state.predroppable;
    if (pd.current) {
        pd.current = undefined;
        callUserFunction(pd.events.unset);
    }
}
exports.unsetPredrop = unsetPredrop;
function tryAutoCastle(state, orig, dest) {
    if (!state.autoCastle)
        return false;
    const king = state.pieces[orig];
    if (!king || king.role !== 'king')
        return false;
    const firstRankIs0 = state.dimensions.height === 10;
    const origPos = util_1.key2pos(orig, firstRankIs0);
    if (origPos[0] !== 5)
        return false;
    if (origPos[1] !== 1 && origPos[1] !== 8)
        return false;
    const destPos = util_1.key2pos(dest, firstRankIs0);
    let oldRookPos, newRookPos, newKingPos;
    if (destPos[0] === 7 || destPos[0] === 8) {
        oldRookPos = util_1.pos2key([8, origPos[1]], state.geometry);
        newRookPos = util_1.pos2key([6, origPos[1]], state.geometry);
        newKingPos = util_1.pos2key([7, origPos[1]], state.geometry);
    }
    else if (destPos[0] === 3 || destPos[0] === 1) {
        oldRookPos = util_1.pos2key([1, origPos[1]], state.geometry);
        newRookPos = util_1.pos2key([4, origPos[1]], state.geometry);
        newKingPos = util_1.pos2key([3, origPos[1]], state.geometry);
    }
    else
        return false;
    const rook = state.pieces[oldRookPos];
    if (!rook || rook.role !== 'rook')
        return false;
    delete state.pieces[orig];
    delete state.pieces[oldRookPos];
    state.pieces[newKingPos] = king;
    state.pieces[newRookPos] = rook;
    return true;
}
function baseMove(state, orig, dest) {
    const origPiece = state.pieces[orig], destPiece = state.pieces[dest];
    if (orig === dest || !origPiece)
        return false;
    const captured = (destPiece && destPiece.color !== origPiece.color) ? destPiece : undefined;
    if (dest == state.selected)
        unselect(state);
    callUserFunction(state.events.move, orig, dest, captured);
    if (!tryAutoCastle(state, orig, dest)) {
        state.pieces[dest] = origPiece;
        delete state.pieces[orig];
    }
    state.lastMove = [orig, dest];
    state.check = undefined;
    callUserFunction(state.events.change);
    return captured || true;
}
exports.baseMove = baseMove;
function baseNewPiece(state, piece, key, force) {
    if (state.pieces[key]) {
        if (force)
            delete state.pieces[key];
        else
            return false;
    }
    callUserFunction(state.events.dropNewPiece, piece, key);
    state.pieces[key] = piece;
    state.lastMove = [key];
    state.check = undefined;
    callUserFunction(state.events.change);
    state.movable.dests = undefined;
    state.turnColor = util_1.opposite(state.turnColor);
    return true;
}
exports.baseNewPiece = baseNewPiece;
function baseUserMove(state, orig, dest) {
    const result = baseMove(state, orig, dest);
    if (result) {
        state.movable.dests = undefined;
        state.turnColor = util_1.opposite(state.turnColor);
        state.animation.current = undefined;
    }
    return result;
}
function userMove(state, orig, dest) {
    if (canMove(state, orig, dest)) {
        const result = baseUserMove(state, orig, dest);
        if (result) {
            const holdTime = state.hold.stop();
            unselect(state);
            const metadata = {
                premove: false,
                ctrlKey: state.stats.ctrlKey,
                holdTime
            };
            if (result !== true)
                metadata.captured = result;
            callUserFunction(state.movable.events.after, orig, dest, metadata);
            return true;
        }
    }
    else if (canPremove(state, orig, dest)) {
        setPremove(state, orig, dest, {
            ctrlKey: state.stats.ctrlKey
        });
        unselect(state);
        return true;
    }
    unselect(state);
    return false;
}
exports.userMove = userMove;
function dropNewPiece(state, orig, dest, force) {
    if (canDrop(state, orig, dest) || force) {
        const piece = state.pieces[orig];
        delete state.pieces[orig];
        baseNewPiece(state, piece, dest, force);
        callUserFunction(state.movable.events.afterNewPiece, piece.role, dest, {
            predrop: false
        });
    }
    else if (canPredrop(state, orig, dest)) {
        setPredrop(state, state.pieces[orig].role, dest);
    }
    else {
        unsetPremove(state);
        unsetPredrop(state);
    }
    delete state.pieces[orig];
    unselect(state);
}
exports.dropNewPiece = dropNewPiece;
function selectSquare(state, key, force) {
    callUserFunction(state.events.select, key);
    if (state.selected) {
        if (state.selected === key && !state.draggable.enabled) {
            unselect(state);
            state.hold.cancel();
            return;
        }
        else if ((state.selectable.enabled || force) && state.selected !== key) {
            if (userMove(state, state.selected, key)) {
                state.stats.dragged = false;
                return;
            }
        }
    }
    if (isMovable(state, key) || isPremovable(state, key)) {
        setSelected(state, key);
        state.hold.start();
    }
}
exports.selectSquare = selectSquare;
function setSelected(state, key) {
    state.selected = key;
    if (isPremovable(state, key)) {
        state.premovable.dests = premove_1.default(state.pieces, key, state.premovable.castle, state.geometry);
    }
    else
        state.premovable.dests = undefined;
}
exports.setSelected = setSelected;
function unselect(state) {
    state.selected = undefined;
    state.premovable.dests = undefined;
    state.hold.cancel();
}
exports.unselect = unselect;
function isMovable(state, orig) {
    const piece = state.pieces[orig];
    return !!piece && (state.movable.color === 'both' || (state.movable.color === piece.color &&
        state.turnColor === piece.color));
}
function canMove(state, orig, dest) {
    return orig !== dest && isMovable(state, orig) && (state.movable.free || (!!state.movable.dests && util_1.containsX(state.movable.dests[orig], dest)));
}
exports.canMove = canMove;
function canDrop(state, orig, dest) {
    const piece = state.pieces[orig];
    return !!piece && dest && (orig === dest || !state.pieces[dest]) && (state.movable.color === 'both' || (state.movable.color === piece.color &&
        state.turnColor === piece.color));
}
function isPremovable(state, orig) {
    const piece = state.pieces[orig];
    return !!piece && state.premovable.enabled &&
        state.movable.color === piece.color &&
        state.turnColor !== piece.color;
}
function canPremove(state, orig, dest) {
    return orig !== dest &&
        isPremovable(state, orig) &&
        util_1.containsX(premove_1.default(state.pieces, orig, state.premovable.castle, state.geometry), dest);
}
function canPredrop(state, orig, dest) {
    const piece = state.pieces[orig];
    const destPiece = state.pieces[dest];
    return !!piece && dest &&
        (!destPiece || destPiece.color !== state.movable.color) &&
        state.predroppable.enabled &&
        (piece.role !== 'pawn' || (dest[1] !== '1' && dest[1] !== '8')) &&
        state.movable.color === piece.color &&
        state.turnColor !== piece.color;
}
function isDraggable(state, orig) {
    const piece = state.pieces[orig];
    return !!piece && state.draggable.enabled && (state.movable.color === 'both' || (state.movable.color === piece.color && (state.turnColor === piece.color || state.premovable.enabled)));
}
exports.isDraggable = isDraggable;
function playPremove(state) {
    const move = state.premovable.current;
    if (!move)
        return false;
    const orig = move[0], dest = move[1];
    let success = false;
    if (canMove(state, orig, dest)) {
        const result = baseUserMove(state, orig, dest);
        if (result) {
            const metadata = { premove: true };
            if (result !== true)
                metadata.captured = result;
            callUserFunction(state.movable.events.after, orig, dest, metadata);
            success = true;
        }
    }
    unsetPremove(state);
    return success;
}
exports.playPremove = playPremove;
function playPredrop(state, validate) {
    let drop = state.predroppable.current, success = false;
    if (!drop)
        return false;
    if (validate(drop)) {
        const piece = {
            role: drop.role,
            color: state.movable.color
        };
        if (baseNewPiece(state, piece, drop.key)) {
            callUserFunction(state.movable.events.afterNewPiece, drop.role, drop.key, {
                predrop: true
            });
            success = true;
        }
    }
    unsetPredrop(state);
    return success;
}
exports.playPredrop = playPredrop;
function cancelMove(state) {
    unsetPremove(state);
    unsetPredrop(state);
    unselect(state);
}
exports.cancelMove = cancelMove;
function stop(state) {
    state.movable.color =
        state.movable.dests =
            state.animation.current = undefined;
    cancelMove(state);
}
exports.stop = stop;
function getKeyAtDomPos(pos, asWhite, bounds, geom) {
    const bd = cg.dimensions[geom];
    let file = Math.ceil(bd.width * ((pos[0] - bounds.left) / bounds.width));
    if (!asWhite)
        file = bd.width + 1 - file;
    let rank = Math.ceil(bd.height - (bd.height * ((pos[1] - bounds.top) / bounds.height)));
    if (!asWhite)
        rank = bd.height + 1 - rank;
    return (file > 0 && file < bd.width + 1 && rank > 0 && rank < bd.height + 1) ? util_1.pos2key([file, rank], geom) : undefined;
}
exports.getKeyAtDomPos = getKeyAtDomPos;
function whitePov(s) {
    return s.orientation === 'white';
}
exports.whitePov = whitePov;

},{"./premove":12,"./types":16,"./util":17}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("./api");
const config_1 = require("./config");
const state_1 = require("./state");
const wrap_1 = require("./wrap");
const events = require("./events");
const render_1 = require("./render");
const svg = require("./svg");
const util = require("./util");
function Chessground(element, config) {
    const state = state_1.defaults();
    config_1.configure(state, config || {});
    function redrawAll() {
        let prevUnbind = state.dom && state.dom.unbind;
        const relative = state.viewOnly && !state.drawable.visible, elements = wrap_1.default(element, state, relative), bounds = util.memo(() => elements.board.getBoundingClientRect()), redrawNow = (skipSvg) => {
            render_1.default(state);
            if (!skipSvg && elements.svg)
                svg.renderSvg(state, elements.svg);
        };
        state.dom = {
            elements,
            bounds,
            redraw: debounceRedraw(redrawNow),
            redrawNow,
            unbind: prevUnbind,
            relative
        };
        state.drawable.prevSvgHash = '';
        redrawNow(false);
        events.bindBoard(state);
        if (!prevUnbind)
            state.dom.unbind = events.bindDocument(state, redrawAll);
        state.events.insert && state.events.insert(elements);
    }
    redrawAll();
    return api_1.start(state, redrawAll);
}
exports.Chessground = Chessground;
;
function debounceRedraw(redrawNow) {
    let redrawing = false;
    return () => {
        if (redrawing)
            return;
        redrawing = true;
        requestAnimationFrame(() => {
            redrawNow();
            redrawing = false;
        });
    };
}

},{"./api":2,"./config":5,"./events":9,"./render":13,"./state":14,"./svg":15,"./util":17,"./wrap":18}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board_1 = require("./board");
const fen_1 = require("./fen");
const cg = require("./types");
function configure(state, config) {
    if (config.movable && config.movable.dests)
        state.movable.dests = undefined;
    merge(state, config);
    if (config.geometry)
        state.dimensions = cg.dimensions[config.geometry];
    if (config.fen) {
        state.pieces = fen_1.read(config.fen);
        state.drawable.shapes = [];
    }
    if (config.hasOwnProperty('check'))
        board_1.setCheck(state, config.check || false);
    if (config.hasOwnProperty('lastMove') && !config.lastMove)
        state.lastMove = undefined;
    else if (config.lastMove)
        state.lastMove = config.lastMove;
    if (state.selected)
        board_1.setSelected(state, state.selected);
    if (!state.animation.duration || state.animation.duration < 100)
        state.animation.enabled = false;
    if (!state.movable.rookCastle && state.movable.dests) {
        const rank = state.movable.color === 'white' ? 1 : 8, kingStartPos = 'e' + rank, dests = state.movable.dests[kingStartPos], king = state.pieces[kingStartPos];
        if (!dests || !king || king.role !== 'king')
            return;
        state.movable.dests[kingStartPos] = dests.filter(d => !((d === 'a' + rank) && dests.indexOf('c' + rank) !== -1) &&
            !((d === 'h' + rank) && dests.indexOf('g' + rank) !== -1));
    }
}
exports.configure = configure;
;
function merge(base, extend) {
    for (let key in extend) {
        if (isObject(base[key]) && isObject(extend[key]))
            merge(base[key], extend[key]);
        else
            base[key] = extend[key];
    }
}
function isObject(o) {
    return typeof o === 'object';
}

},{"./board":3,"./fen":11,"./types":16}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board = require("./board");
const util = require("./util");
const draw_1 = require("./draw");
const anim_1 = require("./anim");
function start(s, e) {
    if (e.button !== undefined && e.button !== 0)
        return;
    if (e.touches && e.touches.length > 1)
        return;
    const bounds = s.dom.bounds(), position = util.eventPosition(e), orig = board.getKeyAtDomPos(position, board.whitePov(s), bounds, s.geometry);
    if (!orig)
        return;
    const piece = s.pieces[orig];
    const previouslySelected = s.selected;
    if (!previouslySelected && s.drawable.enabled && (s.drawable.eraseOnClick || (!piece || piece.color !== s.turnColor)))
        draw_1.clear(s);
    if (e.cancelable !== false &&
        (!e.touches || !s.movable.color || piece || previouslySelected || pieceCloseTo(s, position)))
        e.preventDefault();
    const hadPremove = !!s.premovable.current;
    const hadPredrop = !!s.predroppable.current;
    s.stats.ctrlKey = e.ctrlKey;
    if (s.selected && board.canMove(s, s.selected, orig)) {
        anim_1.anim(state => board.selectSquare(state, orig), s);
    }
    else {
        board.selectSquare(s, orig);
    }
    const stillSelected = s.selected === orig;
    const element = pieceElementByKey(s, orig);
    const firstRankIs0 = s.dimensions.height === 10;
    if (piece && element && stillSelected && board.isDraggable(s, orig)) {
        const squareBounds = computeSquareBounds(orig, board.whitePov(s), bounds, s.dimensions);
        s.draggable.current = {
            orig,
            origPos: util.key2pos(orig, firstRankIs0),
            piece,
            rel: position,
            epos: position,
            pos: [0, 0],
            dec: s.draggable.centerPiece ? [
                position[0] - (squareBounds.left + squareBounds.width / 2),
                position[1] - (squareBounds.top + squareBounds.height / 2)
            ] : [0, 0],
            started: s.draggable.autoDistance && s.stats.dragged,
            element,
            previouslySelected,
            originTarget: e.target
        };
        element.cgDragging = true;
        element.classList.add('dragging');
        const ghost = s.dom.elements.ghost;
        if (ghost) {
            ghost.className = `ghost ${piece.color} ${piece.role}`;
            util.translateAbs(ghost, util.posToTranslateAbs(bounds, s.dimensions)(util.key2pos(orig, firstRankIs0), board.whitePov(s)));
            util.setVisible(ghost, true);
        }
        processDrag(s);
    }
    else {
        if (hadPremove)
            board.unsetPremove(s);
        if (hadPredrop)
            board.unsetPredrop(s);
    }
    s.dom.redraw();
}
exports.start = start;
function pieceCloseTo(s, pos) {
    const asWhite = board.whitePov(s), bounds = s.dom.bounds(), radiusSq = Math.pow(bounds.width / 8, 2);
    for (let key in s.pieces) {
        const squareBounds = computeSquareBounds(key, asWhite, bounds, s.dimensions), center = [
            squareBounds.left + squareBounds.width / 2,
            squareBounds.top + squareBounds.height / 2
        ];
        if (util.distanceSq(center, pos) <= radiusSq)
            return true;
    }
    return false;
}
exports.pieceCloseTo = pieceCloseTo;
function dragNewPiece(s, piece, e, force) {
    const key = 'a0';
    s.pieces[key] = piece;
    s.dom.redraw();
    const position = util.eventPosition(e), asWhite = board.whitePov(s), bounds = s.dom.bounds(), squareBounds = computeSquareBounds(key, asWhite, bounds, s.dimensions);
    const rel = [
        (asWhite ? 0 : s.dimensions.width - 1) * squareBounds.width + bounds.left,
        (asWhite ? s.dimensions.height : -1) * squareBounds.height + bounds.top
    ];
    const firstRankIs0 = s.dimensions.height === 10;
    s.draggable.current = {
        orig: key,
        origPos: util.key2pos(key, firstRankIs0),
        piece,
        rel,
        epos: position,
        pos: [position[0] - rel[0], position[1] - rel[1]],
        dec: [-squareBounds.width / 2, -squareBounds.height / 2],
        started: true,
        element: () => pieceElementByKey(s, key),
        originTarget: e.target,
        newPiece: true,
        force: !!force
    };
    processDrag(s);
}
exports.dragNewPiece = dragNewPiece;
function processDrag(s) {
    requestAnimationFrame(() => {
        const cur = s.draggable.current;
        if (!cur)
            return;
        if (s.animation.current && s.animation.current.plan.anims[cur.orig])
            s.animation.current = undefined;
        const origPiece = s.pieces[cur.orig];
        if (!origPiece || !util.samePiece(origPiece, cur.piece))
            cancel(s);
        else {
            if (!cur.started && util.distanceSq(cur.epos, cur.rel) >= Math.pow(s.draggable.distance, 2))
                cur.started = true;
            if (cur.started) {
                if (typeof cur.element === 'function') {
                    const found = cur.element();
                    if (!found)
                        return;
                    found.cgDragging = true;
                    found.classList.add('dragging');
                    cur.element = found;
                }
                cur.pos = [
                    cur.epos[0] - cur.rel[0],
                    cur.epos[1] - cur.rel[1]
                ];
                const translation = util.posToTranslateAbs(s.dom.bounds(), s.dimensions)(cur.origPos, board.whitePov(s));
                translation[0] += cur.pos[0] + cur.dec[0];
                translation[1] += cur.pos[1] + cur.dec[1];
                util.translateAbs(cur.element, translation);
            }
        }
        processDrag(s);
    });
}
function move(s, e) {
    if (s.draggable.current && (!e.touches || e.touches.length < 2)) {
        s.draggable.current.epos = util.eventPosition(e);
    }
}
exports.move = move;
function end(s, e) {
    const cur = s.draggable.current;
    if (!cur)
        return;
    if (e.type === 'touchend' && e.cancelable !== false)
        e.preventDefault();
    if (e.type === 'touchend' && cur && cur.originTarget !== e.target && !cur.newPiece) {
        s.draggable.current = undefined;
        return;
    }
    board.unsetPremove(s);
    board.unsetPredrop(s);
    const eventPos = util.eventPosition(e) || cur.epos;
    const dest = board.getKeyAtDomPos(eventPos, board.whitePov(s), s.dom.bounds(), s.geometry);
    if (dest && cur.started && cur.orig !== dest) {
        if (cur.newPiece)
            board.dropNewPiece(s, cur.orig, dest, cur.force);
        else {
            s.stats.ctrlKey = e.ctrlKey;
            if (board.userMove(s, cur.orig, dest))
                s.stats.dragged = true;
        }
    }
    else if (cur.newPiece) {
        delete s.pieces[cur.orig];
    }
    else if (s.draggable.deleteOnDropOff && !dest) {
        delete s.pieces[cur.orig];
        board.callUserFunction(s.events.change);
    }
    if (cur && cur.orig === cur.previouslySelected && (cur.orig === dest || !dest))
        board.unselect(s);
    else if (!s.selectable.enabled)
        board.unselect(s);
    removeDragElements(s);
    s.draggable.current = undefined;
    s.dom.redraw();
}
exports.end = end;
function cancel(s) {
    const cur = s.draggable.current;
    if (cur) {
        if (cur.newPiece)
            delete s.pieces[cur.orig];
        s.draggable.current = undefined;
        board.unselect(s);
        removeDragElements(s);
        s.dom.redraw();
    }
}
exports.cancel = cancel;
function removeDragElements(s) {
    const e = s.dom.elements;
    if (e.ghost)
        util.setVisible(e.ghost, false);
}
function computeSquareBounds(key, asWhite, bounds, bd) {
    const firstRankIs0 = bd.height === 10;
    const pos = util.key2pos(key, firstRankIs0);
    if (!asWhite) {
        pos[0] = bd.width + 1 - pos[0];
        pos[1] = bd.height + 1 - pos[1];
    }
    return {
        left: bounds.left + bounds.width * (pos[0] - 1) / bd.width,
        top: bounds.top + bounds.height * (bd.height - pos[1]) / bd.height,
        width: bounds.width / bd.width,
        height: bounds.height / bd.height
    };
}
function pieceElementByKey(s, key) {
    let el = s.dom.elements.board.firstChild;
    while (el) {
        if (el.cgKey === key && el.tagName === 'PIECE')
            return el;
        el = el.nextSibling;
    }
    return undefined;
}

},{"./anim":1,"./board":3,"./draw":7,"./util":17}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board_1 = require("./board");
const util_1 = require("./util");
const brushes = ['green', 'red', 'blue', 'yellow'];
function start(state, e) {
    if (e.touches && e.touches.length > 1)
        return;
    e.stopPropagation();
    e.preventDefault();
    e.ctrlKey ? board_1.unselect(state) : board_1.cancelMove(state);
    const pos = util_1.eventPosition(e), orig = board_1.getKeyAtDomPos(pos, board_1.whitePov(state), state.dom.bounds(), state.geometry);
    if (!orig)
        return;
    state.drawable.current = {
        orig,
        pos,
        brush: eventBrush(e)
    };
    processDraw(state);
}
exports.start = start;
function processDraw(state) {
    requestAnimationFrame(() => {
        const cur = state.drawable.current;
        if (cur) {
            const mouseSq = board_1.getKeyAtDomPos(cur.pos, board_1.whitePov(state), state.dom.bounds(), state.geometry);
            if (mouseSq !== cur.mouseSq) {
                cur.mouseSq = mouseSq;
                cur.dest = mouseSq !== cur.orig ? mouseSq : undefined;
                state.dom.redrawNow();
            }
            processDraw(state);
        }
    });
}
exports.processDraw = processDraw;
function move(state, e) {
    if (state.drawable.current)
        state.drawable.current.pos = util_1.eventPosition(e);
}
exports.move = move;
function end(state) {
    const cur = state.drawable.current;
    if (cur) {
        if (cur.mouseSq)
            addShape(state.drawable, cur);
        cancel(state);
    }
}
exports.end = end;
function cancel(state) {
    if (state.drawable.current) {
        state.drawable.current = undefined;
        state.dom.redraw();
    }
}
exports.cancel = cancel;
function clear(state) {
    if (state.drawable.shapes.length) {
        state.drawable.shapes = [];
        state.dom.redraw();
        onChange(state.drawable);
    }
}
exports.clear = clear;
function eventBrush(e) {
    return brushes[(e.shiftKey && util_1.isRightButton(e) ? 1 : 0) + (e.altKey ? 2 : 0)];
}
function addShape(drawable, cur) {
    const sameShape = (s) => s.orig === cur.orig && s.dest === cur.dest;
    const similar = drawable.shapes.filter(sameShape)[0];
    if (similar)
        drawable.shapes = drawable.shapes.filter(s => !sameShape(s));
    if (!similar || similar.brush !== cur.brush)
        drawable.shapes.push(cur);
    onChange(drawable);
}
function onChange(drawable) {
    if (drawable.onChange)
        drawable.onChange(drawable.shapes);
}

},{"./board":3,"./util":17}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const board = require("./board");
const util = require("./util");
const drag_1 = require("./drag");
function setDropMode(s, piece) {
    s.dropmode = {
        active: true,
        piece
    };
    drag_1.cancel(s);
}
exports.setDropMode = setDropMode;
function cancelDropMode(s) {
    s.dropmode = {
        active: false
    };
}
exports.cancelDropMode = cancelDropMode;
function drop(s, e) {
    if (!s.dropmode.active)
        return;
    board.unsetPremove(s);
    board.unsetPredrop(s);
    const piece = s.dropmode.piece;
    if (piece) {
        s.pieces.a0 = piece;
        const position = util.eventPosition(e);
        const dest = position && board.getKeyAtDomPos(position, board.whitePov(s), s.dom.bounds(), s.geometry);
        if (dest)
            board.dropNewPiece(s, 'a0', dest);
    }
    s.dom.redraw();
}
exports.drop = drop;

},{"./board":3,"./drag":6,"./util":17}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const drag = require("./drag");
const draw = require("./draw");
const drop_1 = require("./drop");
const util_1 = require("./util");
function bindBoard(s) {
    if (s.viewOnly)
        return;
    const boardEl = s.dom.elements.board, onStart = startDragOrDraw(s);
    boardEl.addEventListener('touchstart', onStart, { passive: false });
    boardEl.addEventListener('mousedown', onStart, { passive: false });
    if (s.disableContextMenu || s.drawable.enabled) {
        boardEl.addEventListener('contextmenu', e => e.preventDefault());
    }
}
exports.bindBoard = bindBoard;
function bindDocument(s, redrawAll) {
    const unbinds = [];
    if (!s.dom.relative && s.resizable) {
        const onResize = () => {
            s.dom.bounds.clear();
            requestAnimationFrame(redrawAll);
        };
        unbinds.push(unbindable(document.body, 'chessground.resize', onResize));
    }
    if (!s.viewOnly) {
        const onmove = dragOrDraw(s, drag.move, draw.move);
        const onend = dragOrDraw(s, drag.end, draw.end);
        ['touchmove', 'mousemove'].forEach(ev => unbinds.push(unbindable(document, ev, onmove)));
        ['touchend', 'mouseup'].forEach(ev => unbinds.push(unbindable(document, ev, onend)));
        const onScroll = () => s.dom.bounds.clear();
        unbinds.push(unbindable(window, 'scroll', onScroll, { passive: true }));
        unbinds.push(unbindable(window, 'resize', onScroll, { passive: true }));
    }
    return () => unbinds.forEach(f => f());
}
exports.bindDocument = bindDocument;
function unbindable(el, eventName, callback, options) {
    el.addEventListener(eventName, callback, options);
    return () => el.removeEventListener(eventName, callback);
}
function startDragOrDraw(s) {
    return e => {
        if (s.draggable.current)
            drag.cancel(s);
        else if (s.drawable.current)
            draw.cancel(s);
        else if (e.shiftKey || util_1.isRightButton(e)) {
            if (s.drawable.enabled)
                draw.start(s, e);
        }
        else if (!s.viewOnly) {
            if (s.dropmode.active)
                drop_1.drop(s, e);
            else
                drag.start(s, e);
        }
    };
}
function dragOrDraw(s, withDrag, withDraw) {
    return e => {
        if (e.shiftKey || util_1.isRightButton(e)) {
            if (s.drawable.enabled)
                withDraw(s, e);
        }
        else if (!s.viewOnly)
            withDrag(s, e);
    };
}

},{"./drag":6,"./draw":7,"./drop":8,"./util":17}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function explosion(state, keys) {
    state.exploding = { stage: 1, keys };
    state.dom.redraw();
    setTimeout(() => {
        setStage(state, 2);
        setTimeout(() => setStage(state, undefined), 120);
    }, 120);
}
exports.default = explosion;
function setStage(state, stage) {
    if (state.exploding) {
        if (stage)
            state.exploding.stage = stage;
        else
            state.exploding = undefined;
        state.dom.redraw();
    }
}

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const cg = require("./types");
exports.initial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const roles8 = {
    p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king', m: 'met', f: 'ferz', s: 'silver', c: 'cancellor', a: 'archbishop', h: 'hawk', e: 'elephant'
};
const roles9 = {
    p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', k: 'king', g: 'gold', s: 'silver', l: 'lance'
};
const roles10 = {
    p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', k: 'king', c: 'cannon', a: 'advisor'
};
const letters8 = {
    pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', queen: 'q', king: 'k', met: 'm', ferz: 'f', silver: 's', cancellor: 'c', archbishop: 'a', hawk: 'h', elephant: 'e'
};
const letters9 = {
    pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', king: 'k', gold: 'g', silver: 's', lance: 'l',
    ppawn: '+p', pknight: '+n', pbishop: '+b', prook: '+r', psilver: '+s', plance: '+l'
};
const letters10 = {
    pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', king: 'k', cannon: 'c', advisor: 'a'
};
function read(fen) {
    if (fen === 'start')
        fen = exports.initial;
    if (fen.indexOf('[') !== -1)
        fen = fen.slice(0, fen.indexOf('['));
    const pieces = {};
    let row = fen.split("/").length;
    let col = 0;
    let promoted = false;
    const roles = row === 10 ? roles10 : row === 9 ? roles9 : roles8;
    const firstRankIs0 = row === 10;
    const shogi = row === 9;
    for (const c of fen) {
        switch (c) {
            case ' ': return pieces;
            case '/':
                --row;
                if (row === 0)
                    return pieces;
                col = 0;
                break;
            case '+':
                promoted = true;
                break;
            case '~':
                const piece = pieces[cg.files[col] + cg.ranks[firstRankIs0 ? row : row + 1]];
                if (piece)
                    piece.promoted = true;
                break;
            default:
                const nb = c.charCodeAt(0);
                if (nb < 58)
                    col += (c === '0') ? 9 : nb - 48;
                else {
                    ++col;
                    const role = c.toLowerCase();
                    let piece = {
                        role: roles[role],
                        color: (c === role ? shogi ? 'white' : 'black' : shogi ? 'black' : 'white')
                    };
                    if (promoted) {
                        piece.role = 'p' + piece.role;
                        piece.promoted = true;
                        promoted = false;
                    }
                    ;
                    if (shogi) {
                        pieces[cg.files[10 - col - 1] + cg.ranks[10 - row]] = piece;
                    }
                    else {
                        pieces[cg.files[col - 1] + cg.ranks[firstRankIs0 ? row - 1 : row]] = piece;
                    }
                    ;
                }
        }
    }
    return pieces;
}
exports.read = read;
function write(pieces, geom) {
    const height = cg.dimensions[geom].height;
    var letters = {};
    switch (height) {
        case 10:
            letters = letters10;
            break;
        case 9:
            letters = letters9;
            break;
        default:
            letters = letters8;
            break;
    }
    ;
    return util_1.invNRanks.map(y => util_1.NRanks.map(x => {
        const piece = pieces[util_1.pos2key([x, y], geom)];
        if (piece) {
            const letter = letters[piece.role];
            return piece.color === 'white' ? letter.toUpperCase() : letter;
        }
        else
            return '1';
    }).join('')).join('/').replace(/1{2,}/g, s => s.length.toString());
}
exports.write = write;

},{"./types":16,"./util":17}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("./util");
const cg = require("./types");
function diff(a, b) {
    return Math.abs(a - b);
}
function pawn(color) {
    return (x1, y1, x2, y2) => diff(x1, x2) < 2 && (color === 'white' ? (y2 === y1 + 1 || (y1 <= 2 && y2 === (y1 + 2) && x1 === x2)) : (y2 === y1 - 1 || (y1 >= 7 && y2 === (y1 - 2) && x1 === x2)));
}
const knight = (x1, y1, x2, y2) => {
    const xd = diff(x1, x2);
    const yd = diff(y1, y2);
    return (xd === 1 && yd === 2) || (xd === 2 && yd === 1);
};
const bishop = (x1, y1, x2, y2) => {
    return diff(x1, x2) === diff(y1, y2);
};
const rook = (x1, y1, x2, y2) => {
    return x1 === x2 || y1 === y2;
};
const queen = (x1, y1, x2, y2) => {
    return bishop(x1, y1, x2, y2) || rook(x1, y1, x2, y2);
};
function king(color, rookFiles, canCastle) {
    return (x1, y1, x2, y2) => (diff(x1, x2) < 2 && diff(y1, y2) < 2) || (canCastle && y1 === y2 && y1 === (color === 'white' ? 1 : 8) && ((x1 === 5 && (x2 === 3 || x2 === 7)) || util.containsX(rookFiles, x2)));
}
const met = (x1, y1, x2, y2) => {
    return diff(x1, x2) === diff(y1, y2) && diff(x1, x2) === 1;
};
const archbishop = (x1, y1, x2, y2) => {
    return bishop(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
const cancellor = (x1, y1, x2, y2) => {
    return rook(x1, y1, x2, y2) || knight(x1, y1, x2, y2);
};
function lance(color) {
    return (x1, y1, x2, y2) => (x2 === x1 && (color === 'white' ? y2 > y1 : y2 < y1));
}
function silver(color) {
    return (x1, y1, x2, y2) => (met(x1, y1, x2, y2) || (x1 === x2 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1)));
}
function gold(color) {
    return (x1, y1, x2, y2) => (diff(x1, x2) < 2 && diff(y1, y2) < 2 && (color === 'white' ?
        !((x2 === x1 - 1 && y2 === y1 - 1) || (x2 === x1 + 1 && y2 === y1 - 1)) :
        !((x2 === x1 + 1 && y2 === y1 + 1) || (x2 === x1 - 1 && y2 === y1 + 1))));
}
function spawn(color) {
    return (x1, y1, x2, y2) => (x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1));
}
function sknight(color) {
    return (x1, y1, x2, y2) => color === 'white' ?
        (y2 === y1 + 2 && x2 === x1 - 1 || y2 === y1 + 2 && x2 === x1 + 1) :
        (y2 === y1 - 2 && x2 === x1 - 1 || y2 === y1 - 2 && x2 === x1 + 1);
}
const prook = (x1, y1, x2, y2) => {
    return rook(x1, y1, x2, y2) || (diff(x1, x2) < 2 && diff(y1, y2) < 2);
};
const pbishop = (x1, y1, x2, y2) => {
    return bishop(x1, y1, x2, y2) || (diff(x1, x2) < 2 && diff(y1, y2) < 2);
};
const sking = (x1, y1, x2, y2) => {
    return diff(x1, x2) < 2 && diff(y1, y2) < 2;
};
function xpawn(color) {
    return (x1, y1, x2, y2) => ((x2 === x1 && (color === 'white' ? y2 === y1 + 1 : y2 === y1 - 1)) ||
        (y2 === y1 && (x2 === x1 + 1 || x2 === x1 - 1) && (color === 'white' ? y1 > 5 : y1 < 6)));
}
const xbishop = (x1, y1, x2, y2) => {
    return diff(x1, x2) === diff(y1, y2) && diff(x1, x2) === 2;
};
const advisor = (x1, y1, x2, y2) => {
    return diff(x1, x2) === diff(y1, y2) && diff(x1, x2) === 1;
};
const xking = (x1, y1, x2, y2) => {
    return (x1 === x2 || y1 === y2) && diff(x1, x2) === 1;
};
function rookFilesOf(pieces, color, firstRankIs0) {
    return Object.keys(pieces).filter(key => {
        const piece = pieces[key];
        return piece && piece.color === color && piece.role === 'rook';
    }).map((key) => util.key2pos(key, firstRankIs0)[0]);
}
function premove(pieces, key, canCastle, geom) {
    const firstRankIs0 = cg.dimensions[geom].height === 10;
    const piece = pieces[key], pos = util.key2pos(key, firstRankIs0);
    let mobility;
    switch (geom) {
        case 3:
            switch (piece.role) {
                case 'pawn':
                    mobility = xpawn(piece.color);
                    break;
                case 'cannon':
                case 'rook':
                    mobility = rook;
                    break;
                case 'knight':
                    mobility = knight;
                    break;
                case 'bishop':
                    mobility = xbishop;
                    break;
                case 'advisor':
                    mobility = advisor;
                    break;
                case 'king':
                    mobility = xking;
                    break;
            }
            ;
            break;
        case 1:
            switch (piece.role) {
                case 'pawn':
                    mobility = spawn(piece.color);
                    break;
                case 'knight':
                    mobility = sknight(piece.color);
                    break;
                case 'bishop':
                    mobility = bishop;
                    break;
                case 'rook':
                    mobility = rook;
                    break;
                case 'king':
                    mobility = sking;
                    break;
                case 'silver':
                    mobility = silver(piece.color);
                    break;
                case 'ppawn':
                case 'plance':
                case 'pknight':
                case 'psilver':
                case 'gold':
                    mobility = gold(piece.color);
                    break;
                case 'lance':
                    mobility = lance(piece.color);
                    break;
                case 'prook':
                    mobility = prook;
                    break;
                case 'pbishop':
                    mobility = pbishop;
                    break;
            }
            ;
            break;
        default:
            switch (piece.role) {
                case 'pawn':
                    mobility = pawn(piece.color);
                    break;
                case 'knight':
                    mobility = knight;
                    break;
                case 'bishop':
                    mobility = bishop;
                    break;
                case 'rook':
                    mobility = rook;
                    break;
                case 'queen':
                    mobility = queen;
                    break;
                case 'king':
                    mobility = king(piece.color, rookFilesOf(pieces, piece.color, firstRankIs0), canCastle);
                    break;
                case 'hawk':
                case 'archbishop':
                    mobility = archbishop;
                    break;
                case 'elephant':
                case 'cancellor':
                    mobility = cancellor;
                    break;
                case 'met':
                case 'ferz':
                    mobility = met;
                    break;
                case 'silver':
                    mobility = silver(piece.color);
                    break;
            }
            ;
            break;
    }
    ;
    const allkeys = util.allKeys[geom];
    const pos2keyGeom = (geom) => ((pos) => util.pos2key(pos, geom));
    const pos2key = pos2keyGeom(geom);
    const key2posRank0 = (firstrank0) => ((key) => util.key2pos(key, firstrank0));
    const key2pos = key2posRank0(firstRankIs0);
    return allkeys.map(key2pos).filter(pos2 => {
        return (pos[0] !== pos2[0] || pos[1] !== pos2[1]) && mobility(pos[0], pos[1], pos2[0], pos2[1]);
    }).map(pos2key);
}
exports.default = premove;
;

},{"./types":16,"./util":17}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const board_1 = require("./board");
const util = require("./util");
function render(s) {
    const firstRankIs0 = s.dimensions.height === 10;
    const asWhite = board_1.whitePov(s), posToTranslate = s.dom.relative ? util.posToTranslateRel : util.posToTranslateAbs(s.dom.bounds(), s.dimensions), translate = s.dom.relative ? util.translateRel : util.translateAbs, boardEl = s.dom.elements.board, pieces = s.pieces, curAnim = s.animation.current, anims = curAnim ? curAnim.plan.anims : {}, fadings = curAnim ? curAnim.plan.fadings : {}, curDrag = s.draggable.current, squares = computeSquareClasses(s), samePieces = {}, sameSquares = {}, movedPieces = {}, movedSquares = {}, piecesKeys = Object.keys(pieces);
    let k, p, el, pieceAtKey, elPieceName, anim, fading, pMvdset, pMvd, sMvdset, sMvd;
    el = boardEl.firstChild;
    while (el) {
        k = el.cgKey;
        if (isPieceNode(el)) {
            pieceAtKey = pieces[k];
            anim = anims[k];
            fading = fadings[k];
            elPieceName = el.cgPiece;
            if (el.cgDragging && (!curDrag || curDrag.orig !== k)) {
                el.classList.remove('dragging');
                translate(el, posToTranslate(util_1.key2pos(k, firstRankIs0), asWhite, s.dimensions));
                el.cgDragging = false;
            }
            if (!fading && el.cgFading) {
                el.cgFading = false;
                el.classList.remove('fading');
            }
            if (pieceAtKey) {
                if (anim && el.cgAnimating && elPieceName === pieceNameOf(pieceAtKey)) {
                    const pos = util_1.key2pos(k, firstRankIs0);
                    pos[0] += anim[2];
                    pos[1] += anim[3];
                    el.classList.add('anim');
                    translate(el, posToTranslate(pos, asWhite, s.dimensions));
                }
                else if (el.cgAnimating) {
                    el.cgAnimating = false;
                    el.classList.remove('anim');
                    translate(el, posToTranslate(util_1.key2pos(k, firstRankIs0), asWhite, s.dimensions));
                    if (s.addPieceZIndex)
                        el.style.zIndex = posZIndex(util_1.key2pos(k, firstRankIs0), asWhite);
                }
                if (elPieceName === pieceNameOf(pieceAtKey) && (!fading || !el.cgFading)) {
                    samePieces[k] = true;
                }
                else {
                    if (fading && elPieceName === pieceNameOf(fading)) {
                        el.classList.add('fading');
                        el.cgFading = true;
                    }
                    else {
                        if (movedPieces[elPieceName])
                            movedPieces[elPieceName].push(el);
                        else
                            movedPieces[elPieceName] = [el];
                    }
                }
            }
            else {
                if (movedPieces[elPieceName])
                    movedPieces[elPieceName].push(el);
                else
                    movedPieces[elPieceName] = [el];
            }
        }
        else if (isSquareNode(el)) {
            const cn = el.className;
            if (squares[k] === cn)
                sameSquares[k] = true;
            else if (movedSquares[cn])
                movedSquares[cn].push(el);
            else
                movedSquares[cn] = [el];
        }
        el = el.nextSibling;
    }
    for (const sk in squares) {
        if (!sameSquares[sk]) {
            sMvdset = movedSquares[squares[sk]];
            sMvd = sMvdset && sMvdset.pop();
            const translation = posToTranslate(util_1.key2pos(sk, firstRankIs0), asWhite, s.dimensions);
            if (sMvd) {
                sMvd.cgKey = sk;
                translate(sMvd, translation);
            }
            else {
                const squareNode = util_1.createEl('square', squares[sk]);
                squareNode.cgKey = sk;
                translate(squareNode, translation);
                boardEl.insertBefore(squareNode, boardEl.firstChild);
            }
        }
    }
    for (const j in piecesKeys) {
        k = piecesKeys[j];
        p = pieces[k];
        anim = anims[k];
        if (!samePieces[k]) {
            pMvdset = movedPieces[pieceNameOf(p)];
            pMvd = pMvdset && pMvdset.pop();
            if (pMvd) {
                pMvd.cgKey = k;
                if (pMvd.cgFading) {
                    pMvd.classList.remove('fading');
                    pMvd.cgFading = false;
                }
                const pos = util_1.key2pos(k, firstRankIs0);
                if (s.addPieceZIndex)
                    pMvd.style.zIndex = posZIndex(pos, asWhite);
                if (anim) {
                    pMvd.cgAnimating = true;
                    pMvd.classList.add('anim');
                    pos[0] += anim[2];
                    pos[1] += anim[3];
                }
                translate(pMvd, posToTranslate(pos, asWhite, s.dimensions));
            }
            else {
                const pieceName = pieceNameOf(p), pieceNode = util_1.createEl('piece', pieceName), pos = util_1.key2pos(k, firstRankIs0);
                pieceNode.cgPiece = pieceName;
                pieceNode.cgKey = k;
                if (anim) {
                    pieceNode.cgAnimating = true;
                    pos[0] += anim[2];
                    pos[1] += anim[3];
                }
                translate(pieceNode, posToTranslate(pos, asWhite, s.dimensions));
                if (s.addPieceZIndex)
                    pieceNode.style.zIndex = posZIndex(pos, asWhite);
                boardEl.appendChild(pieceNode);
            }
        }
    }
    for (const i in movedPieces)
        removeNodes(s, movedPieces[i]);
    for (const i in movedSquares)
        removeNodes(s, movedSquares[i]);
}
exports.default = render;
function isPieceNode(el) {
    return el.tagName === 'PIECE';
}
function isSquareNode(el) {
    return el.tagName === 'SQUARE';
}
function removeNodes(s, nodes) {
    for (const i in nodes)
        s.dom.elements.board.removeChild(nodes[i]);
}
function posZIndex(pos, asWhite) {
    let z = 2 + (pos[1] - 1) * 8 + (8 - pos[0]);
    if (asWhite)
        z = 67 - z;
    return z + '';
}
function pieceNameOf(piece) {
    return `${piece.color} ${piece.role}`;
}
function computeSquareClasses(s) {
    const squares = {};
    let i, k;
    if (s.lastMove && s.highlight.lastMove)
        for (i in s.lastMove) {
            if (s.lastMove[i] != 'a0') {
                addSquare(squares, s.lastMove[i], 'last-move');
            }
        }
    if (s.check && s.highlight.check)
        addSquare(squares, s.check, 'check');
    if (s.selected) {
        if (s.selected != 'a0') {
            addSquare(squares, s.selected, 'selected');
        }
        if (s.movable.showDests) {
            const dests = s.movable.dests && s.movable.dests[s.selected];
            if (dests)
                for (i in dests) {
                    k = dests[i];
                    addSquare(squares, k, 'move-dest' + (s.pieces[k] ? ' oc' : ''));
                }
            const pDests = s.premovable.dests;
            if (pDests)
                for (i in pDests) {
                    k = pDests[i];
                    addSquare(squares, k, 'premove-dest' + (s.pieces[k] ? ' oc' : ''));
                }
        }
    }
    const premove = s.premovable.current;
    if (premove)
        for (i in premove)
            addSquare(squares, premove[i], 'current-premove');
    else if (s.predroppable.current)
        addSquare(squares, s.predroppable.current.key, 'current-premove');
    const o = s.exploding;
    if (o)
        for (i in o.keys)
            addSquare(squares, o.keys[i], 'exploding' + o.stage);
    return squares;
}
function addSquare(squares, key, klass) {
    if (squares[key])
        squares[key] += ' ' + klass;
    else
        squares[key] = klass;
}

},{"./board":3,"./util":17}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fen = require("./fen");
const util_1 = require("./util");
function defaults() {
    return {
        pieces: fen.read(fen.initial),
        orientation: 'white',
        turnColor: 'white',
        coordinates: true,
        autoCastle: true,
        viewOnly: false,
        disableContextMenu: false,
        resizable: true,
        addPieceZIndex: false,
        pieceKey: false,
        highlight: {
            lastMove: true,
            check: true
        },
        animation: {
            enabled: true,
            duration: 200
        },
        movable: {
            free: true,
            color: 'both',
            showDests: true,
            events: {},
            rookCastle: true
        },
        premovable: {
            enabled: true,
            showDests: true,
            castle: true,
            events: {}
        },
        predroppable: {
            enabled: false,
            events: {}
        },
        draggable: {
            enabled: true,
            distance: 3,
            autoDistance: true,
            centerPiece: true,
            showGhost: true,
            deleteOnDropOff: false
        },
        dropmode: {
            active: false
        },
        selectable: {
            enabled: true
        },
        stats: {
            dragged: !('ontouchstart' in window)
        },
        events: {},
        drawable: {
            enabled: true,
            visible: true,
            eraseOnClick: true,
            shapes: [],
            autoShapes: [],
            brushes: {
                green: { key: 'g', color: '#15781B', opacity: 1, lineWidth: 10 },
                red: { key: 'r', color: '#882020', opacity: 1, lineWidth: 10 },
                blue: { key: 'b', color: '#003088', opacity: 1, lineWidth: 10 },
                yellow: { key: 'y', color: '#e68f00', opacity: 1, lineWidth: 10 },
                paleBlue: { key: 'pb', color: '#003088', opacity: 0.4, lineWidth: 15 },
                paleGreen: { key: 'pg', color: '#15781B', opacity: 0.4, lineWidth: 15 },
                paleRed: { key: 'pr', color: '#882020', opacity: 0.4, lineWidth: 15 },
                paleGrey: { key: 'pgr', color: '#4a4a4a', opacity: 0.35, lineWidth: 15 }
            },
            pieces: {
                baseUrl: 'https://lichess1.org/assets/piece/cburnett/'
            },
            prevSvgHash: ''
        },
        hold: util_1.timer(),
        dimensions: { width: 8, height: 8 },
        geometry: 0,
    };
}
exports.defaults = defaults;

},{"./fen":11,"./util":17}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
function createElement(tagName) {
    return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}
exports.createElement = createElement;
function renderSvg(state, root) {
    const d = state.drawable, curD = d.current, cur = curD && curD.mouseSq ? curD : undefined, arrowDests = {};
    d.shapes.concat(d.autoShapes).concat(cur ? [cur] : []).forEach(s => {
        if (s.dest)
            arrowDests[s.dest] = (arrowDests[s.dest] || 0) + 1;
    });
    const shapes = d.shapes.concat(d.autoShapes).map((s) => {
        return {
            shape: s,
            current: false,
            hash: shapeHash(s, arrowDests, false)
        };
    });
    if (cur)
        shapes.push({
            shape: cur,
            current: true,
            hash: shapeHash(cur, arrowDests, true)
        });
    const fullHash = shapes.map(sc => sc.hash).join('');
    if (fullHash === state.drawable.prevSvgHash)
        return;
    state.drawable.prevSvgHash = fullHash;
    const defsEl = root.firstChild;
    syncDefs(d, shapes, defsEl);
    syncShapes(state, shapes, d.brushes, arrowDests, root, defsEl);
}
exports.renderSvg = renderSvg;
function syncDefs(d, shapes, defsEl) {
    const brushes = {};
    let brush;
    shapes.forEach(s => {
        if (s.shape.dest) {
            brush = d.brushes[s.shape.brush];
            if (s.shape.modifiers)
                brush = makeCustomBrush(brush, s.shape.modifiers);
            brushes[brush.key] = brush;
        }
    });
    const keysInDom = {};
    let el = defsEl.firstChild;
    while (el) {
        keysInDom[el.getAttribute('cgKey')] = true;
        el = el.nextSibling;
    }
    for (let key in brushes) {
        if (!keysInDom[key])
            defsEl.appendChild(renderMarker(brushes[key]));
    }
}
function syncShapes(state, shapes, brushes, arrowDests, root, defsEl) {
    const bounds = state.dom.bounds(), hashesInDom = {}, toRemove = [];
    shapes.forEach(sc => { hashesInDom[sc.hash] = false; });
    let el = defsEl.nextSibling, elHash;
    while (el) {
        elHash = el.getAttribute('cgHash');
        if (hashesInDom.hasOwnProperty(elHash))
            hashesInDom[elHash] = true;
        else
            toRemove.push(el);
        el = el.nextSibling;
    }
    toRemove.forEach(el => root.removeChild(el));
    shapes.forEach(sc => {
        if (!hashesInDom[sc.hash])
            root.appendChild(renderShape(state, sc, brushes, arrowDests, bounds));
    });
}
function shapeHash({ orig, dest, brush, piece, modifiers }, arrowDests, current) {
    return [current, orig, dest, brush, dest && arrowDests[dest] > 1,
        piece && pieceHash(piece),
        modifiers && modifiersHash(modifiers)
    ].filter(x => x).join('');
}
function pieceHash(piece) {
    return [piece.color, piece.role, piece.scale].filter(x => x).join('');
}
function modifiersHash(m) {
    return '' + (m.lineWidth || '');
}
function renderShape(state, { shape, current, hash }, brushes, arrowDests, bounds) {
    const firstRankIs0 = state.dimensions.height === 10;
    let el;
    if (shape.piece)
        el = renderPiece(state.drawable.pieces.baseUrl, orient(util_1.key2pos(shape.orig, firstRankIs0), state.orientation, state.dimensions), shape.piece, bounds, state.dimensions);
    else {
        const orig = orient(util_1.key2pos(shape.orig, firstRankIs0), state.orientation, state.dimensions);
        if (shape.orig && shape.dest) {
            let brush = brushes[shape.brush];
            if (shape.modifiers)
                brush = makeCustomBrush(brush, shape.modifiers);
            el = renderArrow(brush, orig, orient(util_1.key2pos(shape.dest, firstRankIs0), state.orientation, state.dimensions), current, arrowDests[shape.dest] > 1, bounds, state.dimensions);
        }
        else
            el = renderCircle(brushes[shape.brush], orig, current, bounds, state.dimensions);
    }
    el.setAttribute('cgHash', hash);
    return el;
}
function renderCircle(brush, pos, current, bounds, bd) {
    const o = pos2px(pos, bounds, bd), widths = circleWidth(bounds, bd), radius = (bounds.width / bd.width) / 2;
    return setAttributes(createElement('circle'), {
        stroke: brush.color,
        'stroke-width': widths[current ? 0 : 1],
        fill: 'none',
        opacity: opacity(brush, current),
        cx: o[0],
        cy: o[1],
        r: radius - widths[1] / 2
    });
}
function renderArrow(brush, orig, dest, current, shorten, bounds, bd) {
    const m = arrowMargin(bounds, shorten && !current, bd), a = pos2px(orig, bounds, bd), b = pos2px(dest, bounds, bd), dx = b[0] - a[0], dy = b[1] - a[1], angle = Math.atan2(dy, dx), xo = Math.cos(angle) * m, yo = Math.sin(angle) * m;
    return setAttributes(createElement('line'), {
        stroke: brush.color,
        'stroke-width': lineWidth(brush, current, bounds, bd),
        'stroke-linecap': 'round',
        'marker-end': 'url(#arrowhead-' + brush.key + ')',
        opacity: opacity(brush, current),
        x1: a[0],
        y1: a[1],
        x2: b[0] - xo,
        y2: b[1] - yo
    });
}
function renderPiece(baseUrl, pos, piece, bounds, bd) {
    const o = pos2px(pos, bounds, bd), width = bounds.width / bd.width * (piece.scale || 1), height = bounds.width / bd.height * (piece.scale || 1), name = piece.color[0] + (piece.role === 'knight' ? 'n' : piece.role[0]).toUpperCase();
    return setAttributes(createElement('image'), {
        className: `${piece.role} ${piece.color}`,
        x: o[0] - width / 2,
        y: o[1] - height / 2,
        width: width,
        height: height,
        href: baseUrl + name + '.svg'
    });
}
function renderMarker(brush) {
    const marker = setAttributes(createElement('marker'), {
        id: 'arrowhead-' + brush.key,
        orient: 'auto',
        markerWidth: 4,
        markerHeight: 8,
        refX: 2.05,
        refY: 2.01
    });
    marker.appendChild(setAttributes(createElement('path'), {
        d: 'M0,0 V4 L3,2 Z',
        fill: brush.color
    }));
    marker.setAttribute('cgKey', brush.key);
    return marker;
}
function setAttributes(el, attrs) {
    for (let key in attrs)
        el.setAttribute(key, attrs[key]);
    return el;
}
function orient(pos, color, bd) {
    return color === 'white' ? pos : [bd.width + 1 - pos[0], bd.height + 1 - pos[1]];
}
function makeCustomBrush(base, modifiers) {
    const brush = {
        color: base.color,
        opacity: Math.round(base.opacity * 10) / 10,
        lineWidth: Math.round(modifiers.lineWidth || base.lineWidth)
    };
    brush.key = [base.key, modifiers.lineWidth].filter(x => x).join('');
    return brush;
}
function circleWidth(bounds, bd) {
    const base = bounds.width / (bd.width * 64);
    return [3 * base, 4 * base];
}
function lineWidth(brush, current, bounds, bd) {
    return (brush.lineWidth || 10) * (current ? 0.85 : 1) / (bd.width * 64) * bounds.width;
}
function opacity(brush, current) {
    return (brush.opacity || 1) * (current ? 0.9 : 1);
}
function arrowMargin(bounds, shorten, bd) {
    return (shorten ? 20 : 10) / (bd.width * 64) * bounds.width;
}
function pos2px(pos, bounds, bd) {
    return [(pos[0] - 0.5) * bounds.width / bd.width, (bd.height + 0.5 - pos[1]) * bounds.height / bd.height];
}

},{"./util":17}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
exports.ranks = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
;
exports.dimensions = [{ width: 8, height: 8 }, { width: 9, height: 9 }, { width: 10, height: 8 }, { width: 9, height: 10 }];

},{}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cg = require("./types");
exports.colors = ['white', 'black'];
exports.NRanks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
exports.invNRanks = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const files8 = cg.files.slice(0, 8);
const files9 = cg.files.slice(0, 9);
const files10 = cg.files.slice(0, 10);
const ranks8 = cg.ranks.slice(1, 9);
const ranks9 = cg.ranks.slice(1, 10);
const ranks10 = cg.ranks.slice(0, 10);
const allKeys8x8 = Array.prototype.concat(...files8.map(c => ranks8.map(r => c + r)));
const allKeys9x9 = Array.prototype.concat(...files9.map(c => ranks9.map(r => c + r)));
const allKeys10x8 = Array.prototype.concat(...files10.map(c => ranks8.map(r => c + r)));
const allKeys9x10 = Array.prototype.concat(...files9.map(c => ranks10.map(r => c + r)));
exports.allKeys = [allKeys8x8, allKeys9x9, allKeys10x8, allKeys9x10];
function pos2key(pos, geom) {
    const bd = cg.dimensions[geom];
    return exports.allKeys[geom][bd.height * pos[0] + pos[1] - bd.height - 1];
}
exports.pos2key = pos2key;
function key2pos(k, firstRankIs0) {
    const shift = firstRankIs0 ? 1 : 0;
    return [k.charCodeAt(0) - 96, k.charCodeAt(1) - 48 + shift];
}
exports.key2pos = key2pos;
function memo(f) {
    let v;
    const ret = () => {
        if (v === undefined)
            v = f();
        return v;
    };
    ret.clear = () => { v = undefined; };
    return ret;
}
exports.memo = memo;
exports.timer = () => {
    let startAt;
    return {
        start() { startAt = performance.now(); },
        cancel() { startAt = undefined; },
        stop() {
            if (!startAt)
                return 0;
            const time = performance.now() - startAt;
            startAt = undefined;
            return time;
        }
    };
};
exports.opposite = (c) => c === 'white' ? 'black' : 'white';
function containsX(xs, x) {
    return xs !== undefined && xs.indexOf(x) !== -1;
}
exports.containsX = containsX;
exports.distanceSq = (pos1, pos2) => {
    return Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[1] - pos2[1], 2);
};
exports.samePiece = (p1, p2) => p1.role === p2.role && p1.color === p2.color;
const posToTranslateBase = (pos, asWhite, xFactor, yFactor, bt) => [
    (asWhite ? pos[0] - 1 : bt.width - pos[0]) * xFactor,
    (asWhite ? bt.height - pos[1] : pos[1] - 1) * yFactor
];
exports.posToTranslateAbs = (bounds, bt) => {
    const xFactor = bounds.width / bt.width, yFactor = bounds.height / bt.height;
    return (pos, asWhite) => posToTranslateBase(pos, asWhite, xFactor, yFactor, bt);
};
exports.posToTranslateRel = (pos, asWhite, bt) => posToTranslateBase(pos, asWhite, 100 / bt.width, 100 / bt.height, bt);
exports.translateAbs = (el, pos) => {
    el.style.transform = `translate(${pos[0]}px,${pos[1]}px)`;
};
exports.translateRel = (el, percents) => {
    el.style.left = percents[0] + '%';
    el.style.top = percents[1] + '%';
};
exports.setVisible = (el, v) => {
    el.style.visibility = v ? 'visible' : 'hidden';
};
exports.eventPosition = e => {
    if (e.clientX || e.clientX === 0)
        return [e.clientX, e.clientY];
    if (e.touches && e.targetTouches[0])
        return [e.targetTouches[0].clientX, e.targetTouches[0].clientY];
    return undefined;
};
exports.isRightButton = (e) => e.buttons === 2 || e.button === 2;
exports.createEl = (tagName, className) => {
    const el = document.createElement(tagName);
    if (className)
        el.className = className;
    return el;
};

},{"./types":16}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const types_1 = require("./types");
const svg_1 = require("./svg");
function wrap(element, s, relative) {
    element.innerHTML = '';
    element.classList.add('cg-wrap');
    util_1.colors.forEach(c => element.classList.toggle('orientation-' + c, s.orientation === c));
    element.classList.toggle('manipulable', !s.viewOnly);
    const helper = util_1.createEl('cg-helper');
    element.appendChild(helper);
    const container = util_1.createEl('cg-container');
    helper.appendChild(container);
    const extension = util_1.createEl('extension');
    container.appendChild(extension);
    const board = util_1.createEl('cg-board');
    container.appendChild(board);
    let svg;
    if (s.drawable.visible && !relative) {
        svg = svg_1.createElement('svg');
        svg.appendChild(svg_1.createElement('defs'));
        container.appendChild(svg);
    }
    if (s.coordinates) {
        const orientClass = s.orientation === 'black' ? ' black' : '';
        const firstRankIs0 = s.dimensions.height === 10;
        const shift = firstRankIs0 ? 0 : 1;
        container.appendChild(renderCoords(types_1.ranks.slice(shift, s.dimensions.height + shift), 'ranks' + orientClass));
        container.appendChild(renderCoords(types_1.files.slice(0, s.dimensions.width), 'files' + orientClass));
    }
    let ghost;
    if (s.draggable.showGhost && !relative) {
        ghost = util_1.createEl('piece', 'ghost');
        util_1.setVisible(ghost, false);
        container.appendChild(ghost);
    }
    return {
        board,
        container,
        ghost,
        svg
    };
}
exports.default = wrap;
function renderCoords(elems, className) {
    const el = util_1.createEl('coords', className);
    let f;
    for (let i in elems) {
        f = util_1.createEl('coord');
        f.textContent = elems[i];
        el.appendChild(f);
    }
    return el;
}

},{"./svg":15,"./types":16,"./util":17}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vnode_1 = require("./vnode");
var is = require("./is");
function addNS(data, children, sel) {
    data.ns = 'http://www.w3.org/2000/svg';
    if (sel !== 'foreignObject' && children !== undefined) {
        for (var i = 0; i < children.length; ++i) {
            var childData = children[i].data;
            if (childData !== undefined) {
                addNS(childData, children[i].children, children[i].sel);
            }
        }
    }
}
function h(sel, b, c) {
    var data = {}, children, text, i;
    if (c !== undefined) {
        data = b;
        if (is.array(c)) {
            children = c;
        }
        else if (is.primitive(c)) {
            text = c;
        }
        else if (c && c.sel) {
            children = [c];
        }
    }
    else if (b !== undefined) {
        if (is.array(b)) {
            children = b;
        }
        else if (is.primitive(b)) {
            text = b;
        }
        else if (b && b.sel) {
            children = [b];
        }
        else {
            data = b;
        }
    }
    if (children !== undefined) {
        for (i = 0; i < children.length; ++i) {
            if (is.primitive(children[i]))
                children[i] = vnode_1.vnode(undefined, undefined, undefined, children[i], undefined);
        }
    }
    if (sel[0] === 's' && sel[1] === 'v' && sel[2] === 'g' &&
        (sel.length === 3 || sel[3] === '.' || sel[3] === '#')) {
        addNS(data, children, sel);
    }
    return vnode_1.vnode(sel, data, children, text, undefined);
}
exports.h = h;
;
exports.default = h;

},{"./is":21,"./vnode":29}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function createElement(tagName) {
    return document.createElement(tagName);
}
function createElementNS(namespaceURI, qualifiedName) {
    return document.createElementNS(namespaceURI, qualifiedName);
}
function createTextNode(text) {
    return document.createTextNode(text);
}
function createComment(text) {
    return document.createComment(text);
}
function insertBefore(parentNode, newNode, referenceNode) {
    parentNode.insertBefore(newNode, referenceNode);
}
function removeChild(node, child) {
    node.removeChild(child);
}
function appendChild(node, child) {
    node.appendChild(child);
}
function parentNode(node) {
    return node.parentNode;
}
function nextSibling(node) {
    return node.nextSibling;
}
function tagName(elm) {
    return elm.tagName;
}
function setTextContent(node, text) {
    node.textContent = text;
}
function getTextContent(node) {
    return node.textContent;
}
function isElement(node) {
    return node.nodeType === 1;
}
function isText(node) {
    return node.nodeType === 3;
}
function isComment(node) {
    return node.nodeType === 8;
}
exports.htmlDomApi = {
    createElement: createElement,
    createElementNS: createElementNS,
    createTextNode: createTextNode,
    createComment: createComment,
    insertBefore: insertBefore,
    removeChild: removeChild,
    appendChild: appendChild,
    parentNode: parentNode,
    nextSibling: nextSibling,
    tagName: tagName,
    setTextContent: setTextContent,
    getTextContent: getTextContent,
    isElement: isElement,
    isText: isText,
    isComment: isComment,
};
exports.default = exports.htmlDomApi;

},{}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.array = Array.isArray;
function primitive(s) {
    return typeof s === 'string' || typeof s === 'number';
}
exports.primitive = primitive;

},{}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var xlinkNS = 'http://www.w3.org/1999/xlink';
var xmlNS = 'http://www.w3.org/XML/1998/namespace';
var colonChar = 58;
var xChar = 120;
function updateAttrs(oldVnode, vnode) {
    var key, elm = vnode.elm, oldAttrs = oldVnode.data.attrs, attrs = vnode.data.attrs;
    if (!oldAttrs && !attrs)
        return;
    if (oldAttrs === attrs)
        return;
    oldAttrs = oldAttrs || {};
    attrs = attrs || {};
    // update modified attributes, add new attributes
    for (key in attrs) {
        var cur = attrs[key];
        var old = oldAttrs[key];
        if (old !== cur) {
            if (cur === true) {
                elm.setAttribute(key, "");
            }
            else if (cur === false) {
                elm.removeAttribute(key);
            }
            else {
                if (key.charCodeAt(0) !== xChar) {
                    elm.setAttribute(key, cur);
                }
                else if (key.charCodeAt(3) === colonChar) {
                    // Assume xml namespace
                    elm.setAttributeNS(xmlNS, key, cur);
                }
                else if (key.charCodeAt(5) === colonChar) {
                    // Assume xlink namespace
                    elm.setAttributeNS(xlinkNS, key, cur);
                }
                else {
                    elm.setAttribute(key, cur);
                }
            }
        }
    }
    // remove removed attributes
    // use `in` operator since the previous `for` iteration uses it (.i.e. add even attributes with undefined value)
    // the other option is to remove all attributes with value == undefined
    for (key in oldAttrs) {
        if (!(key in attrs)) {
            elm.removeAttribute(key);
        }
    }
}
exports.attributesModule = { create: updateAttrs, update: updateAttrs };
exports.default = exports.attributesModule;

},{}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function updateClass(oldVnode, vnode) {
    var cur, name, elm = vnode.elm, oldClass = oldVnode.data.class, klass = vnode.data.class;
    if (!oldClass && !klass)
        return;
    if (oldClass === klass)
        return;
    oldClass = oldClass || {};
    klass = klass || {};
    for (name in oldClass) {
        if (!klass[name]) {
            elm.classList.remove(name);
        }
    }
    for (name in klass) {
        cur = klass[name];
        if (cur !== oldClass[name]) {
            elm.classList[cur ? 'add' : 'remove'](name);
        }
    }
}
exports.classModule = { create: updateClass, update: updateClass };
exports.default = exports.classModule;

},{}],24:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function invokeHandler(handler, vnode, event) {
    if (typeof handler === "function") {
        // call function handler
        handler.call(vnode, event, vnode);
    }
    else if (typeof handler === "object") {
        // call handler with arguments
        if (typeof handler[0] === "function") {
            // special case for single argument for performance
            if (handler.length === 2) {
                handler[0].call(vnode, handler[1], event, vnode);
            }
            else {
                var args = handler.slice(1);
                args.push(event);
                args.push(vnode);
                handler[0].apply(vnode, args);
            }
        }
        else {
            // call multiple handlers
            for (var i = 0; i < handler.length; i++) {
                invokeHandler(handler[i], vnode, event);
            }
        }
    }
}
function handleEvent(event, vnode) {
    var name = event.type, on = vnode.data.on;
    // call event handler(s) if exists
    if (on && on[name]) {
        invokeHandler(on[name], vnode, event);
    }
}
function createListener() {
    return function handler(event) {
        handleEvent(event, handler.vnode);
    };
}
function updateEventListeners(oldVnode, vnode) {
    var oldOn = oldVnode.data.on, oldListener = oldVnode.listener, oldElm = oldVnode.elm, on = vnode && vnode.data.on, elm = (vnode && vnode.elm), name;
    // optimization for reused immutable handlers
    if (oldOn === on) {
        return;
    }
    // remove existing listeners which no longer used
    if (oldOn && oldListener) {
        // if element changed or deleted we remove all existing listeners unconditionally
        if (!on) {
            for (name in oldOn) {
                // remove listener if element was changed or existing listeners removed
                oldElm.removeEventListener(name, oldListener, false);
            }
        }
        else {
            for (name in oldOn) {
                // remove listener if existing listener removed
                if (!on[name]) {
                    oldElm.removeEventListener(name, oldListener, false);
                }
            }
        }
    }
    // add new listeners which has not already attached
    if (on) {
        // reuse existing listener or create new
        var listener = vnode.listener = oldVnode.listener || createListener();
        // update vnode for listener
        listener.vnode = vnode;
        // if element changed or added we add all needed listeners unconditionally
        if (!oldOn) {
            for (name in on) {
                // add listener if element was changed or new listeners added
                elm.addEventListener(name, listener, false);
            }
        }
        else {
            for (name in on) {
                // add listener if new listener added
                if (!oldOn[name]) {
                    elm.addEventListener(name, listener, false);
                }
            }
        }
    }
}
exports.eventListenersModule = {
    create: updateEventListeners,
    update: updateEventListeners,
    destroy: updateEventListeners
};
exports.default = exports.eventListenersModule;

},{}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function updateProps(oldVnode, vnode) {
    var key, cur, old, elm = vnode.elm, oldProps = oldVnode.data.props, props = vnode.data.props;
    if (!oldProps && !props)
        return;
    if (oldProps === props)
        return;
    oldProps = oldProps || {};
    props = props || {};
    for (key in oldProps) {
        if (!props[key]) {
            delete elm[key];
        }
    }
    for (key in props) {
        cur = props[key];
        old = oldProps[key];
        if (old !== cur && (key !== 'value' || elm[key] !== cur)) {
            elm[key] = cur;
        }
    }
}
exports.propsModule = { create: updateProps, update: updateProps };
exports.default = exports.propsModule;

},{}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vnode_1 = require("./vnode");
var is = require("./is");
var htmldomapi_1 = require("./htmldomapi");
function isUndef(s) { return s === undefined; }
function isDef(s) { return s !== undefined; }
var emptyNode = vnode_1.default('', {}, [], undefined, undefined);
function sameVnode(vnode1, vnode2) {
    return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
}
function isVnode(vnode) {
    return vnode.sel !== undefined;
}
function createKeyToOldIdx(children, beginIdx, endIdx) {
    var i, map = {}, key, ch;
    for (i = beginIdx; i <= endIdx; ++i) {
        ch = children[i];
        if (ch != null) {
            key = ch.key;
            if (key !== undefined)
                map[key] = i;
        }
    }
    return map;
}
var hooks = ['create', 'update', 'remove', 'destroy', 'pre', 'post'];
var h_1 = require("./h");
exports.h = h_1.h;
var thunk_1 = require("./thunk");
exports.thunk = thunk_1.thunk;
function init(modules, domApi) {
    var i, j, cbs = {};
    var api = domApi !== undefined ? domApi : htmldomapi_1.default;
    for (i = 0; i < hooks.length; ++i) {
        cbs[hooks[i]] = [];
        for (j = 0; j < modules.length; ++j) {
            var hook = modules[j][hooks[i]];
            if (hook !== undefined) {
                cbs[hooks[i]].push(hook);
            }
        }
    }
    function emptyNodeAt(elm) {
        var id = elm.id ? '#' + elm.id : '';
        var c = elm.className ? '.' + elm.className.split(' ').join('.') : '';
        return vnode_1.default(api.tagName(elm).toLowerCase() + id + c, {}, [], undefined, elm);
    }
    function createRmCb(childElm, listeners) {
        return function rmCb() {
            if (--listeners === 0) {
                var parent_1 = api.parentNode(childElm);
                api.removeChild(parent_1, childElm);
            }
        };
    }
    function createElm(vnode, insertedVnodeQueue) {
        var i, data = vnode.data;
        if (data !== undefined) {
            if (isDef(i = data.hook) && isDef(i = i.init)) {
                i(vnode);
                data = vnode.data;
            }
        }
        var children = vnode.children, sel = vnode.sel;
        if (sel === '!') {
            if (isUndef(vnode.text)) {
                vnode.text = '';
            }
            vnode.elm = api.createComment(vnode.text);
        }
        else if (sel !== undefined) {
            // Parse selector
            var hashIdx = sel.indexOf('#');
            var dotIdx = sel.indexOf('.', hashIdx);
            var hash = hashIdx > 0 ? hashIdx : sel.length;
            var dot = dotIdx > 0 ? dotIdx : sel.length;
            var tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel;
            var elm = vnode.elm = isDef(data) && isDef(i = data.ns) ? api.createElementNS(i, tag)
                : api.createElement(tag);
            if (hash < dot)
                elm.setAttribute('id', sel.slice(hash + 1, dot));
            if (dotIdx > 0)
                elm.setAttribute('class', sel.slice(dot + 1).replace(/\./g, ' '));
            for (i = 0; i < cbs.create.length; ++i)
                cbs.create[i](emptyNode, vnode);
            if (is.array(children)) {
                for (i = 0; i < children.length; ++i) {
                    var ch = children[i];
                    if (ch != null) {
                        api.appendChild(elm, createElm(ch, insertedVnodeQueue));
                    }
                }
            }
            else if (is.primitive(vnode.text)) {
                api.appendChild(elm, api.createTextNode(vnode.text));
            }
            i = vnode.data.hook; // Reuse variable
            if (isDef(i)) {
                if (i.create)
                    i.create(emptyNode, vnode);
                if (i.insert)
                    insertedVnodeQueue.push(vnode);
            }
        }
        else {
            vnode.elm = api.createTextNode(vnode.text);
        }
        return vnode.elm;
    }
    function addVnodes(parentElm, before, vnodes, startIdx, endIdx, insertedVnodeQueue) {
        for (; startIdx <= endIdx; ++startIdx) {
            var ch = vnodes[startIdx];
            if (ch != null) {
                api.insertBefore(parentElm, createElm(ch, insertedVnodeQueue), before);
            }
        }
    }
    function invokeDestroyHook(vnode) {
        var i, j, data = vnode.data;
        if (data !== undefined) {
            if (isDef(i = data.hook) && isDef(i = i.destroy))
                i(vnode);
            for (i = 0; i < cbs.destroy.length; ++i)
                cbs.destroy[i](vnode);
            if (vnode.children !== undefined) {
                for (j = 0; j < vnode.children.length; ++j) {
                    i = vnode.children[j];
                    if (i != null && typeof i !== "string") {
                        invokeDestroyHook(i);
                    }
                }
            }
        }
    }
    function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
        for (; startIdx <= endIdx; ++startIdx) {
            var i_1 = void 0, listeners = void 0, rm = void 0, ch = vnodes[startIdx];
            if (ch != null) {
                if (isDef(ch.sel)) {
                    invokeDestroyHook(ch);
                    listeners = cbs.remove.length + 1;
                    rm = createRmCb(ch.elm, listeners);
                    for (i_1 = 0; i_1 < cbs.remove.length; ++i_1)
                        cbs.remove[i_1](ch, rm);
                    if (isDef(i_1 = ch.data) && isDef(i_1 = i_1.hook) && isDef(i_1 = i_1.remove)) {
                        i_1(ch, rm);
                    }
                    else {
                        rm();
                    }
                }
                else {
                    api.removeChild(parentElm, ch.elm);
                }
            }
        }
    }
    function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue) {
        var oldStartIdx = 0, newStartIdx = 0;
        var oldEndIdx = oldCh.length - 1;
        var oldStartVnode = oldCh[0];
        var oldEndVnode = oldCh[oldEndIdx];
        var newEndIdx = newCh.length - 1;
        var newStartVnode = newCh[0];
        var newEndVnode = newCh[newEndIdx];
        var oldKeyToIdx;
        var idxInOld;
        var elmToMove;
        var before;
        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            if (oldStartVnode == null) {
                oldStartVnode = oldCh[++oldStartIdx]; // Vnode might have been moved left
            }
            else if (oldEndVnode == null) {
                oldEndVnode = oldCh[--oldEndIdx];
            }
            else if (newStartVnode == null) {
                newStartVnode = newCh[++newStartIdx];
            }
            else if (newEndVnode == null) {
                newEndVnode = newCh[--newEndIdx];
            }
            else if (sameVnode(oldStartVnode, newStartVnode)) {
                patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
                oldStartVnode = oldCh[++oldStartIdx];
                newStartVnode = newCh[++newStartIdx];
            }
            else if (sameVnode(oldEndVnode, newEndVnode)) {
                patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
                oldEndVnode = oldCh[--oldEndIdx];
                newEndVnode = newCh[--newEndIdx];
            }
            else if (sameVnode(oldStartVnode, newEndVnode)) {
                patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
                api.insertBefore(parentElm, oldStartVnode.elm, api.nextSibling(oldEndVnode.elm));
                oldStartVnode = oldCh[++oldStartIdx];
                newEndVnode = newCh[--newEndIdx];
            }
            else if (sameVnode(oldEndVnode, newStartVnode)) {
                patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
                api.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
                oldEndVnode = oldCh[--oldEndIdx];
                newStartVnode = newCh[++newStartIdx];
            }
            else {
                if (oldKeyToIdx === undefined) {
                    oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
                }
                idxInOld = oldKeyToIdx[newStartVnode.key];
                if (isUndef(idxInOld)) {
                    api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
                    newStartVnode = newCh[++newStartIdx];
                }
                else {
                    elmToMove = oldCh[idxInOld];
                    if (elmToMove.sel !== newStartVnode.sel) {
                        api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
                    }
                    else {
                        patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
                        oldCh[idxInOld] = undefined;
                        api.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm);
                    }
                    newStartVnode = newCh[++newStartIdx];
                }
            }
        }
        if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
            if (oldStartIdx > oldEndIdx) {
                before = newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm;
                addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
            }
            else {
                removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
            }
        }
    }
    function patchVnode(oldVnode, vnode, insertedVnodeQueue) {
        var i, hook;
        if (isDef(i = vnode.data) && isDef(hook = i.hook) && isDef(i = hook.prepatch)) {
            i(oldVnode, vnode);
        }
        var elm = vnode.elm = oldVnode.elm;
        var oldCh = oldVnode.children;
        var ch = vnode.children;
        if (oldVnode === vnode)
            return;
        if (vnode.data !== undefined) {
            for (i = 0; i < cbs.update.length; ++i)
                cbs.update[i](oldVnode, vnode);
            i = vnode.data.hook;
            if (isDef(i) && isDef(i = i.update))
                i(oldVnode, vnode);
        }
        if (isUndef(vnode.text)) {
            if (isDef(oldCh) && isDef(ch)) {
                if (oldCh !== ch)
                    updateChildren(elm, oldCh, ch, insertedVnodeQueue);
            }
            else if (isDef(ch)) {
                if (isDef(oldVnode.text))
                    api.setTextContent(elm, '');
                addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
            }
            else if (isDef(oldCh)) {
                removeVnodes(elm, oldCh, 0, oldCh.length - 1);
            }
            else if (isDef(oldVnode.text)) {
                api.setTextContent(elm, '');
            }
        }
        else if (oldVnode.text !== vnode.text) {
            if (isDef(oldCh)) {
                removeVnodes(elm, oldCh, 0, oldCh.length - 1);
            }
            api.setTextContent(elm, vnode.text);
        }
        if (isDef(hook) && isDef(i = hook.postpatch)) {
            i(oldVnode, vnode);
        }
    }
    return function patch(oldVnode, vnode) {
        var i, elm, parent;
        var insertedVnodeQueue = [];
        for (i = 0; i < cbs.pre.length; ++i)
            cbs.pre[i]();
        if (!isVnode(oldVnode)) {
            oldVnode = emptyNodeAt(oldVnode);
        }
        if (sameVnode(oldVnode, vnode)) {
            patchVnode(oldVnode, vnode, insertedVnodeQueue);
        }
        else {
            elm = oldVnode.elm;
            parent = api.parentNode(elm);
            createElm(vnode, insertedVnodeQueue);
            if (parent !== null) {
                api.insertBefore(parent, vnode.elm, api.nextSibling(elm));
                removeVnodes(parent, [oldVnode], 0, 0);
            }
        }
        for (i = 0; i < insertedVnodeQueue.length; ++i) {
            insertedVnodeQueue[i].data.hook.insert(insertedVnodeQueue[i]);
        }
        for (i = 0; i < cbs.post.length; ++i)
            cbs.post[i]();
        return vnode;
    };
}
exports.init = init;

},{"./h":19,"./htmldomapi":20,"./is":21,"./thunk":27,"./vnode":29}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var h_1 = require("./h");
function copyToThunk(vnode, thunk) {
    thunk.elm = vnode.elm;
    vnode.data.fn = thunk.data.fn;
    vnode.data.args = thunk.data.args;
    thunk.data = vnode.data;
    thunk.children = vnode.children;
    thunk.text = vnode.text;
    thunk.elm = vnode.elm;
}
function init(thunk) {
    var cur = thunk.data;
    var vnode = cur.fn.apply(undefined, cur.args);
    copyToThunk(vnode, thunk);
}
function prepatch(oldVnode, thunk) {
    var i, old = oldVnode.data, cur = thunk.data;
    var oldArgs = old.args, args = cur.args;
    if (old.fn !== cur.fn || oldArgs.length !== args.length) {
        copyToThunk(cur.fn.apply(undefined, args), thunk);
        return;
    }
    for (i = 0; i < args.length; ++i) {
        if (oldArgs[i] !== args[i]) {
            copyToThunk(cur.fn.apply(undefined, args), thunk);
            return;
        }
    }
    copyToThunk(oldVnode, thunk);
}
exports.thunk = function thunk(sel, key, fn, args) {
    if (args === undefined) {
        args = fn;
        fn = key;
        key = undefined;
    }
    return h_1.h(sel, {
        key: key,
        hook: { init: init, prepatch: prepatch },
        fn: fn,
        args: args
    });
};
exports.default = exports.thunk;

},{"./h":19}],28:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vnode_1 = require("./vnode");
var htmldomapi_1 = require("./htmldomapi");
function toVNode(node, domApi) {
    var api = domApi !== undefined ? domApi : htmldomapi_1.default;
    var text;
    if (api.isElement(node)) {
        var id = node.id ? '#' + node.id : '';
        var cn = node.getAttribute('class');
        var c = cn ? '.' + cn.split(' ').join('.') : '';
        var sel = api.tagName(node).toLowerCase() + id + c;
        var attrs = {};
        var children = [];
        var name_1;
        var i = void 0, n = void 0;
        var elmAttrs = node.attributes;
        var elmChildren = node.childNodes;
        for (i = 0, n = elmAttrs.length; i < n; i++) {
            name_1 = elmAttrs[i].nodeName;
            if (name_1 !== 'id' && name_1 !== 'class') {
                attrs[name_1] = elmAttrs[i].nodeValue;
            }
        }
        for (i = 0, n = elmChildren.length; i < n; i++) {
            children.push(toVNode(elmChildren[i], domApi));
        }
        return vnode_1.default(sel, { attrs: attrs }, children, undefined, node);
    }
    else if (api.isText(node)) {
        text = api.getTextContent(node);
        return vnode_1.default(undefined, undefined, undefined, text, node);
    }
    else if (api.isComment(node)) {
        text = api.getTextContent(node);
        return vnode_1.default('!', {}, [], text, node);
    }
    else {
        return vnode_1.default('', {}, [], undefined, node);
    }
}
exports.toVNode = toVNode;
exports.default = toVNode;

},{"./htmldomapi":20,"./vnode":29}],29:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function vnode(sel, data, children, text, elm) {
    var key = data === undefined ? undefined : data.key;
    return { sel: sel, data: data, children: children,
        text: text, elm: elm, key: key };
}
exports.vnode = vnode;
exports.default = vnode;

},{}],30:[function(require,module,exports){
function noop() {}

module.exports = function (url, opts) {
	opts = opts || {};

	var ws, num=0, timer=1, $={};
	var max = opts.maxAttempts || Infinity;

	$.open = function () {
		ws = new WebSocket(url, opts.protocols || []);

		ws.onmessage = opts.onmessage || noop;

		ws.onopen = function (e) {
			(opts.onopen || noop)(e);
			num = 0;
		};

		ws.onclose = function (e) {
			e.code === 1e3 || e.code === 1001 || e.code === 1005 || $.reconnect(e);
			(opts.onclose || noop)(e);
		};

		ws.onerror = function (e) {
			(e && e.code==='ECONNREFUSED') ? $.reconnect(e) : (opts.onerror || noop)(e);
		};
	};

	$.reconnect = function (e) {
		if (timer && num++ < max) {
			timer = setTimeout(function () {
				(opts.onreconnect || noop)(e);
				$.open();
			}, opts.timeout || 1e3);
		} else {
			(opts.onmaximum || noop)(e);
		}
	};

	$.json = function (x) {
		ws.send(JSON.stringify(x));
	};

	$.send = function (x) {
		ws.send(x);
	};

	$.close = function (x, y) {
		timer = clearTimeout(timer);
		ws.close(x || 1e3, y);
	};

	$.open(); // init

	return $;
}

},{}],31:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const h_1 = __importDefault(require("snabbdom/h"));
const user_1 = require("./user");
function aboutView(model) {
    user_1.renderUsername(model["home"], model["username"]);
    console.log(model);
    return [h_1.default('aside.sidebar-first'),
        h_1.default('main.main', [
            h_1.default('div.about', [
                h_1.default('h2', "About pychess-variants"),
                h_1.default('p', "pychess-variants is a free, open-source chess server designed to play several chess variants."),
                h_1.default('p', [
                    "Currently supported games are ",
                    h_1.default('a', { attrs: { href: 'https://en.wikipedia.org/wiki/Makruk' } }, 'Makruk'),
                    ", ",
                    h_1.default('a', { attrs: { href: 'https://en.wikipedia.org/wiki/Sittuyin' } }, 'Sittuyin'),
                    ", ",
                    h_1.default('a', { attrs: { href: 'https://en.wikipedia.org/wiki/Shogi' } }, 'Shogi'),
                    ", ",
                    h_1.default('a', { attrs: { href: 'https://en.wikipedia.org/wiki/Xiangqi' } }, 'Xiangqi'),
                    ", ",
                    h_1.default('a', { attrs: { href: 'https://en.wikipedia.org/wiki/Capablanca' } }, 'Capablanca'),
                    ", ",
                    h_1.default('a', { attrs: { href: 'https://en.wikipedia.org/wiki/Seirawan' } }, 'Seirawan'),
                    ", ",
                    h_1.default('a', { attrs: { href: 'http://www.quantumgambitz.com/blog/chess/cga/bronstein-chess-pre-chess-shuffle-chess' } }, 'Placement'),
                    ", ",
                    h_1.default('a', { attrs: { href: 'https://en.wikipedia.org/wiki/Crazyhouse' } }, 'Crazyhouse'),
                    ", ",
                    h_1.default('a', { attrs: { href: 'https://www.twitch.tv/videos/466253815' } }, 'Capahouse'),
                    " and standard ",
                    h_1.default('a', { attrs: { href: 'https://en.wikipedia.org/wiki/Chess' } }, 'Chess.'),
                ]),
                h_1.default('p', ['Additionally you can check Chess960 option in for Standard, Crazyhouse, Capablanca and Capahouse to start games from random positions with ',
                    h_1.default('a', { attrs: { href: 'https://en.wikipedia.org/wiki/Chess960#Castling_rules' } }, 'Chess960 castling rules.')
                ]),
                h_1.default('p', [
                    'For move generation, validation and engine play it uses ',
                    h_1.default('a', { attrs: { href: 'https://github.com/gbtami/Fairy-Stockfish' } }, 'Fairy-Stockfish'),
                    ", ",
                    h_1.default('a', { attrs: { href: 'https://github.com/xqbase/eleeye' } }, 'ElephantEye'),
                    ", ",
                    h_1.default('a', { attrs: { href: 'https://github.com/walker8088/moonfish' } }, 'moonfish'),
                    " and ",
                    h_1.default('a', { attrs: { href: 'https://github.com/gbtami/lichess-bot-variants' } }, 'lichess-bot-variants.'),
                ]),
                h_1.default('p', [
                    'On client side it is based on ',
                    h_1.default('a', { attrs: { href: 'https://github.com/gbtami/chessgroundx' } }, 'chessgroundx.'),
                ]),
                h_1.default('p', [
                    'Source code of server is available at ',
                    h_1.default('a', { attrs: { href: 'https://github.com/gbtami/pychess-variants' } }, 'GitHub.'),
                ]),
            ]),
            h_1.default('aside.sidebar-second'),
        ]),
    ];
}
exports.aboutView = aboutView;

},{"./user":47,"snabbdom/h":19}],32:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
function chatView(ctrl, chatType) {
    function onKeyPress(e) {
        const message = e.target.value;
        if ((e.keyCode == 13 || e.which == 13) && message.length > 0) {
            chatMessage(ctrl.model['username'], message, chatType);
            ctrl.sock.send(JSON.stringify({ "type": chatType, "message": message, "gameId": ctrl.model["gameId"] }));
            e.target.value = "";
        }
    }
    return h_1.default(`div.${chatType}#${chatType}`, { class: { "chat": true } }, [
        h_1.default(`ol#${chatType}-messages`, [h_1.default("div#messages")]),
        h_1.default('input#chat-entry', {
            props: {
                type: "text",
                name: "entry",
                autocomplete: "off",
                placeholder: "Please be nice in the chat!",
                maxlength: "140",
            },
            on: { keypress: (e) => onKeyPress(e) },
        })
    ]);
}
exports.chatView = chatView;
function chatMessage(user, message, chatType) {
    const myDiv = document.getElementById(chatType + '-messages');
    // You must add border widths, padding and margins to the right.
    const isScrolled = myDiv.scrollTop == myDiv.scrollHeight - myDiv.offsetHeight;
    var container = document.getElementById('messages');
    if (user.length === 0) {
        patch(container, h_1.default('div#messages', [h_1.default("li.message.offer", [h_1.default("t", message)])]));
    }
    else if (user === '_server') {
        patch(container, h_1.default('div#messages', [h_1.default("li.message.server", [h_1.default("user", 'Server'), h_1.default("t", message)])]));
    }
    else {
        patch(container, h_1.default('div#messages', [h_1.default("li.message", [h_1.default("user", user), h_1.default("t", message)])]));
    }
    ;
    if (isScrolled)
        myDiv.scrollTop = myDiv.scrollHeight;
}
exports.chatMessage = chatMessage;

},{"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],33:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("chessgroundx/util");
exports.variants = ["makruk", "sittuyin", "placement", "crazyhouse", "standard", "shogi", "xiangqi", "capablanca", "seirawan", "capahouse", "shouse"];
exports.variants960 = ["crazyhouse", "standard", "capablanca", "capahouse"];
exports.VARIANTS = {
    makruk: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "grid", pieces: "makruk", css: ["makruk"], icon: "Q" },
    sittuyin: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "gridx", pieces: "makruk", css: ["makruk"], icon: "R" },
    shogi: { geom: 1 /* dim9x9 */, cg: "cg-576", board: "grid9x9", pieces: "shogi", css: ["shogi0", "shogi0w", "shogi0p"], icon: "K" },
    xiangqi: { geom: 3 /* dim9x10 */, cg: "cg-576-640", board: "river", pieces: "xiangqi", css: ["xiangqi", "xiangqie", "xiangqict2"], icon: "O" },
    placement: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "brown", pieces: "merida", css: ["standard"], icon: "S" },
    crazyhouse: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "brown", pieces: "merida", css: ["standard"], icon: "H" },
    capablanca: { geom: 2 /* dim10x8 */, cg: "cg-640", board: "capablanca", pieces: "merida", css: ["capasei0", "capasei1"], icon: "P" },
    capahouse: { geom: 2 /* dim10x8 */, cg: "cg-640", board: "capablanca", pieces: "merida", css: ["capasei0", "capasei1"], icon: "P" },
    seirawan: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "brown", pieces: "merida", css: ["capasei1", "capasei0"], icon: "L" },
    shouse: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "brown", pieces: "merida", css: ["capasei1", "capasei0"], icon: "L" },
    standard: { geom: 0 /* dim8x8 */, cg: "cg-512", board: "brown", pieces: "merida", css: ["standard"], icon: "M" },
};
function pocketRoles(variant) {
    switch (variant) {
        case "sittuyin":
            return ["rook", "knight", "silver", "ferz", "king"];
        case "crazyhouse":
            return ["pawn", "knight", "bishop", "rook", "queen"];
        case "capahouse":
            return ["pawn", "knight", "bishop", "rook", "queen", "archbishop", "cancellor"];
        case "shogi":
            return ["pawn", "lance", "knight", "bishop", "rook", "silver", "gold"];
        case "shouse":
            return ["pawn", "knight", "bishop", "rook", "queen", "elephant", "hawk"];
        case "seirawan":
            return ["elephant", "hawk"];
        default:
            return ["rook", "knight", "bishop", "queen", "king"];
    }
}
exports.pocketRoles = pocketRoles;
function promotionZone(variant, color) {
    switch (variant) {
        case 'shogi':
            return color === 'white' ? 'a9b9c9d9e9f9g9h9i9a8b8c8d8e8f8g8h8i8a7b7c7d7e7f7g7h7i7' : 'a1b1c1d1e1f1g1h1i1a2b2c2d2e2f2g2h2i2a3b3c3d3e3f3g3h3i3';
        case 'makruk':
            return color === 'white' ? 'a6b6c6d6e6f6g6h6' : 'a3b3c3d3e3f3g3h3';
        case 'sittuyin':
            return color === 'white' ? 'a8b7c6d5e5f6g7h8' : 'a1b2c3d4e4f3g2h1';
        default:
            return color === 'white' ? 'a8b8c8d8e8f8g8h8i8j8' : 'a1b1c1d1e1f1g1h1i1j1';
    }
}
function promotionRoles(variant, role) {
    switch (variant) {
        case "capahouse":
        case "capablanca":
            return ["queen", "knight", "rook", "bishop", "archbishop", "cancellor"];
        case "shouse":
        case "seirawan":
            return ["queen", "knight", "rook", "bishop", "elephant", "hawk"];
        case "shogi":
            return ["p" + role, role];
        default:
            return ["queen", "knight", "rook", "bishop"];
    }
}
exports.promotionRoles = promotionRoles;
function mandatoryPromotion(role, dest, color) {
    switch (role) {
        case "pawn":
        case "lance":
            if (color === "white") {
                return dest[1] === "9";
            }
            else {
                return dest[1] === "1";
            }
        case "knight":
            if (color === "white") {
                return dest[1] === "9" || dest[1] === "8";
            }
            else {
                return dest[1] === "1" || dest[1] === "2";
            }
        default:
            return false;
    }
}
exports.mandatoryPromotion = mandatoryPromotion;
function needPockets(variant) {
    return variant === 'placement' || variant === 'crazyhouse' || variant === 'sittuyin' || variant === 'shogi' || variant === 'seirawan' || variant === 'capahouse' || variant === 'shouse';
}
exports.needPockets = needPockets;
function hasEp(variant) {
    return variant === 'standard' || variant === 'placement' || variant === 'crazyhouse' || variant === 'capablanca' || variant === 'seirawan' || variant === 'capahouse' || variant === 'shouse';
}
exports.hasEp = hasEp;
function diff(a, b) {
    return Math.abs(a - b);
}
function diagonalMove(pos1, pos2) {
    const xd = diff(pos1[0], pos2[0]);
    const yd = diff(pos1[1], pos2[1]);
    return xd === yd && xd === 1;
}
function canGate(fen, piece, orig, dest, meta) {
    console.log("   isGating()", fen, piece, orig, dest, meta);
    const no_gate = [false, false, false, false, false, false];
    if ((piece.color === "white" && orig.slice(1) !== "1") ||
        (piece.color === "black" && orig.slice(1) !== "8") ||
        (piece.role === "hawk") ||
        (piece.role === "elephant"))
        return no_gate;
    // In starting position king and(!) rook virginity is encoded in KQkq
    // "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[HEhe] w KQBCDFGkqbcdfg - 0 1"
    // but after kings moved rook virginity is encoded in AHah
    // rnbq1bnr/ppppkppp/8/4p3/4P3/8/PPPPKPPP/RNBQ1BNR[HEhe] w ABCDFGHabcdfgh - 2 3
    // king virginity is encoded in Ee after any Rook moved but King not
    const parts = fen.split(" ");
    const placement = parts[0];
    const color = parts[1];
    const castl = parts[2];
    // console.log("isGating()", orig, placement, color, castl);
    switch (orig) {
        case "a1":
            if (castl.indexOf("A") === -1 && castl.indexOf("Q") === -1)
                return no_gate;
            break;
        case "b1":
            if (castl.indexOf("B") === -1)
                return no_gate;
            break;
        case "c1":
            if (castl.indexOf("C") === -1)
                return no_gate;
            break;
        case "d1":
            if (castl.indexOf("D") === -1)
                return no_gate;
            break;
        case "e1":
            if (piece.role !== "king") {
                return no_gate;
            }
            else if ((castl.indexOf("K") === -1) && (castl.indexOf("Q") === -1)) {
                return no_gate;
            }
            else if (castl.indexOf("E") === -1) {
                return no_gate;
            }
            ;
            break;
        case "f1":
            if (castl.indexOf("F") === -1)
                return no_gate;
            break;
        case "g1":
            if (castl.indexOf("G") === -1)
                return no_gate;
            break;
        case "h1":
            if (castl.indexOf("H") === -1 && castl.indexOf("K") === -1)
                return no_gate;
            break;
        case "a8":
            if (castl.indexOf("a") === -1 && castl.indexOf("q") === -1)
                return no_gate;
            break;
        case "b8":
            if (castl.indexOf("b") === -1)
                return no_gate;
            break;
        case "c8":
            if (castl.indexOf("c") === -1)
                return no_gate;
            break;
        case "d8":
            if (castl.indexOf("d") === -1)
                return no_gate;
            break;
        case "e8":
            if (piece.role !== "king") {
                return no_gate;
            }
            else if ((castl.indexOf("k") === -1) && (castl.indexOf("q") === -1)) {
                return no_gate;
            }
            else if (castl.indexOf("e") === -1) {
                return no_gate;
            }
            ;
            break;
        case "f8":
            if (castl.indexOf("f") === -1)
                return no_gate;
            break;
        case "g8":
            if (castl.indexOf("g") === -1)
                return no_gate;
            break;
        case "h8":
            if (castl.indexOf("h") === -1 && castl.indexOf("k") === -1)
                return no_gate;
            break;
    }
    ;
    const bracketPos = placement.indexOf("[");
    const pockets = placement.slice(bracketPos);
    const ph = lc(pockets, "h", color === 'w') !== 0;
    const pe = lc(pockets, "e", color === 'w') !== 0;
    const pq = lc(pockets, "q", color === 'w') !== 0;
    const pr = lc(pockets, "r", color === 'w') !== 0;
    const pb = lc(pockets, "b", color === 'w') !== 0;
    const pn = lc(pockets, "n", color === 'w') !== 0;
    return [ph, pe, pq, pr, pb, pn];
}
exports.canGate = canGate;
function isPromotion(variant, piece, orig, dest, meta) {
    if (variant === 'xiangqi')
        return false;
    const pz = promotionZone(variant, piece.color);
    switch (variant) {
        case 'shogi':
            return ['king', 'gold', 'ppawn', 'pknight', 'pbishop', 'prook', 'psilver', 'plance'].indexOf(piece.role) === -1
                && (pz.indexOf(orig) !== -1 || pz.indexOf(dest) !== -1);
        case 'sittuyin':
            // See https://vdocuments.net/how-to-play-myanmar-traditional-chess-eng-book-1.html
            const firstRankIs0 = false;
            const dm = diagonalMove(util_1.key2pos(orig, firstRankIs0), util_1.key2pos(dest, firstRankIs0));
            return piece.role === "pawn" && (orig === dest || (!meta.captured && dm));
        default:
            return piece.role === "pawn" && pz.indexOf(dest) !== -1;
    }
}
exports.isPromotion = isPromotion;
function uci2usi(move) {
    const parts = move.split("");
    if (parts[1] === "@") {
        parts[1] = "*";
        parts[2] = String.fromCharCode(parts[2].charCodeAt() - 48);
        parts[3] = String.fromCharCode(parts[3].charCodeAt() + 48);
    }
    else {
        parts[0] = String.fromCharCode(parts[0].charCodeAt() - 48);
        parts[1] = String.fromCharCode(parts[1].charCodeAt() + 48);
        parts[2] = String.fromCharCode(parts[2].charCodeAt() - 48);
        parts[3] = String.fromCharCode(parts[3].charCodeAt() + 48);
    }
    return parts.join("");
}
exports.uci2usi = uci2usi;
function usi2uci(move) {
    const parts = move.split("");
    if (parts[1] === "*") {
        parts[1] = "@";
        parts[2] = String.fromCharCode(parts[2].charCodeAt() + 48);
        parts[3] = String.fromCharCode(parts[3].charCodeAt() - 48);
    }
    else {
        parts[0] = String.fromCharCode(parts[0].charCodeAt() + 48);
        parts[1] = String.fromCharCode(parts[1].charCodeAt() - 48);
        parts[2] = String.fromCharCode(parts[2].charCodeAt() + 48);
        parts[3] = String.fromCharCode(parts[3].charCodeAt() - 48);
    }
    return parts.join("");
}
exports.usi2uci = usi2uci;
exports.roleToSan = {
    pawn: 'P',
    knight: 'N',
    bishop: 'B',
    rook: 'R',
    queen: 'Q',
    king: 'K',
    archbishop: 'A',
    cancellor: 'C',
    elephant: "E",
    hawk: "H",
    ferz: 'F',
    met: 'M',
    gold: 'G',
    silver: 'S',
    lance: 'L',
};
exports.sanToRole = {
    P: 'pawn',
    N: 'knight',
    B: 'bishop',
    R: 'rook',
    Q: 'queen',
    K: 'king',
    A: 'archbishop',
    C: 'cancellor',
    E: 'elephant',
    H: 'hawk',
    F: 'ferz',
    M: 'met',
    G: 'gold',
    S: 'silver',
    L: 'lance',
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king',
    a: 'archbishop',
    c: 'cancellor',
    e: 'elephant',
    h: 'hawk',
    f: 'ferz',
    m: 'met',
    g: 'gold',
    s: 'silver',
    l: 'lance',
};
// Count given letter occurences in a string
function lc(str, letter, uppercase) {
    var letterCount = 0;
    if (uppercase)
        letter = letter.toUpperCase();
    for (var position = 0; position < str.length; position++) {
        if (str.charAt(position) === letter)
            letterCount += 1;
    }
    return letterCount;
}
exports.lc = lc;

},{"chessgroundx/util":17}],34:[function(require,module,exports){
"use strict";
// https://stackoverflow.com/questions/20618355/the-simplest-possible-javascript-countdown-timer
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
class Clock {
    // game baseTime (min) and increment (sec)
    constructor(baseTime, increment, el, id) {
        this.start = (duration) => {
            if (this.running)
                return;
            if (typeof duration !== "undefined")
                this.duration = duration;
            this.running = true;
            this.startTime = Date.now();
            var that = this;
            var diff;
            (function timer() {
                diff = that.duration - (Date.now() - that.startTime);
                // console.log("timer()", that.duration - diff);
                if (diff <= 0) {
                    that.flagCallback();
                    that.pause(false);
                    return;
                }
                that.timeout = setTimeout(timer, that.granularity);
                that.tickCallbacks.forEach(function (callback) {
                    callback.call(that, that, diff);
                }, that);
            }());
        };
        this.onTick = (callback) => {
            if (typeof callback === 'function') {
                this.tickCallbacks.push(callback);
            }
            return this;
        };
        this.onFlag = (callback) => {
            if (typeof callback === 'function') {
                this.pause(false);
                this.flagCallback = callback;
            }
            return this;
        };
        this.pause = (withIncrement) => {
            if (!this.running)
                return;
            this.running = false;
            if (this.timeout)
                clearTimeout(this.timeout);
            this.timeout = null;
            this.duration -= Date.now() - this.startTime;
            if (withIncrement && this.increment)
                this.duration += this.increment;
            renderTime(this, this.duration);
        };
        this.setTime = (millis) => {
            this.duration = millis;
            renderTime(this, this.duration);
        };
        this.parseTime = (millis) => {
            let minutes = Math.floor(millis / 60000);
            let seconds = (millis % 60000) / 1000;
            let secs, mins;
            if (Math.floor(seconds) == 60) {
                minutes++;
                seconds = 0;
            }
            minutes = Math.max(0, minutes);
            seconds = Math.max(0, seconds);
            if (millis < 10000) {
                secs = seconds.toFixed(1);
            }
            else {
                secs = String(Math.floor(seconds));
            }
            mins = (minutes < 10 ? "0" : "") + String(minutes);
            secs = (seconds < 10 ? "0" : "") + secs;
            return {
                minutes: mins,
                seconds: secs,
            };
        };
        this.duration = baseTime * 1000 * 60;
        this.increment = increment * 1000;
        this.granularity = 500;
        this.running = false;
        this.connecting = false;
        this.timeout = null;
        this.startTime = null;
        this.tickCallbacks = [];
        this.flagCallback = null;
        this.el = el;
        this.id = id;
        renderTime(this, this.duration);
    }
}
exports.Clock = Clock;
function renderTime(clock, time) {
    if (clock.granularity > 100 && time < 10000)
        clock.granularity = 100;
    const parsed = clock.parseTime(time);
    // console.log("renderTime():", time, parsed);
    const date = new Date(time);
    const millis = date.getUTCMilliseconds();
    clock.el = patch(clock.el, snabbdom_1.h('div.clock-wrap#' + clock.id, [
        snabbdom_1.h('div.clock', [
            snabbdom_1.h('div.clock.time.min', { class: { running: clock.running, hurry: time < 10000, connecting: clock.connecting } }, parsed.minutes),
            snabbdom_1.h('div.clock.sep', { class: { running: clock.running, hurry: time < 10000, low: millis < 500, connecting: clock.connecting } }, ':'),
            snabbdom_1.h('div.clock.time.sec', { class: { running: clock.running, hurry: time < 10000, connecting: clock.connecting } }, parsed.seconds)
        ])
    ]));
}
exports.renderTime = renderTime;
function timeago(date) {
    const TZdate = new Date(date + 'Z');
    var val = 0 | (Date.now() - TZdate.getTime()) / 1000;
    var unit, length = { second: 60, minute: 60, hour: 24, day: 7, week: 4.35,
        month: 12, year: 10000 }, result;
    for (unit in length) {
        result = val % length[unit];
        if (!(val = 0 | val / length[unit]))
            return result + ' ' + (result - 1 ? unit + 's' : unit) + ' ago';
    }
    return '';
}
exports.timeago = timeago;
function renderTimeago() {
    var x = document.getElementsByTagName("info-date");
    var i;
    for (i = 0; i < x.length; i++) {
        x[i].innerHTML = timeago(x[i].getAttribute('timestamp'));
    }
    setTimeout(renderTimeago, 1200);
}
exports.renderTimeago = renderTimeago;

},{"snabbdom":26,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],35:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sockette_1 = __importDefault(require("sockette"));
const snabbdom_1 = require("snabbdom");
const h_1 = require("snabbdom/h");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const util_1 = require("chessgroundx/util");
const chessgroundx_1 = require("chessgroundx");
const types_1 = require("chessgroundx/types");
const clock_1 = require("./clock");
const gating_1 = __importDefault(require("./gating"));
const promotion_1 = __importDefault(require("./promotion"));
const pocket_1 = require("./pocket");
const sound_1 = require("./sound");
const chess_1 = require("./chess");
const user_1 = require("./user");
const chat_1 = require("./chat");
const movelist_1 = require("./movelist");
const resize_1 = __importDefault(require("./resize"));
const profile_1 = require("./profile");
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
class RoundController {
    constructor(el, model) {
        this.getGround = () => this.chessground;
        this.getDests = () => this.dests;
        this.setZoom = (zoom) => {
            const el = document.querySelector('.cg-wrap');
            if (el) {
                const baseWidth = types_1.dimensions[chess_1.VARIANTS[this.variant].geom].width * (this.variant === "shogi" ? 52 : 64);
                const baseHeight = types_1.dimensions[chess_1.VARIANTS[this.variant].geom].height * (this.variant === "shogi" ? 60 : 64);
                const pxw = `${zoom / 100 * baseWidth}px`;
                const pxh = `${zoom / 100 * baseHeight}px`;
                el.style.width = pxw;
                el.style.height = pxh;
                document.body.setAttribute('style', '--cgwrapwidth:' + pxw);
                document.body.setAttribute('style', '--cgwrapheight:' + pxh);
                document.body.dispatchEvent(new Event('chessground.resize'));
                localStorage.setItem("zoom", String(zoom));
            }
        };
        this.onMsgGameStart = (msg) => {
            // console.log("got gameStart msg:", msg);
            if (msg.gameId !== this.model["gameId"])
                return;
            if (!this.spectator)
                sound_1.sound.genericNotify();
        };
        this.onMsgNewGame = (msg) => {
            console.log("GameController.onMsgNewGame()", this.model["gameId"]);
            window.location.assign(this.model["home"] + '/' + msg["gameId"]);
        };
        this.rematch = () => {
            console.log("REMATCH");
            this.doSend({ type: "rematch", gameId: this.model["gameId"] });
            // window.location.assign(home);
        };
        this.newOpponent = (home) => {
            window.location.assign(home);
        };
        this.gameOver = () => {
            this.gameControls = patch(this.gameControls, h_1.h('div'));
            var container = document.getElementById('after-game');
            if (this.spectator) {
                patch(container, h_1.h('div.after-game', [h_1.h('result', this.result)]));
            }
            else {
                patch(container, h_1.h('div.after-game', [
                    h_1.h('result', profile_1.result(this.status, this.result)),
                    h_1.h('button.rematch', { on: { click: () => this.rematch() } }, "REMATCH"),
                    h_1.h('button.newopp', { on: { click: () => this.newOpponent(this.model["home"]) } }, "NEW OPPONENT"),
                ]));
            }
        };
        this.checkStatus = (msg) => {
            if (msg.gameId !== this.model["gameId"])
                return;
            if (msg.status >= 0 && this.result === "") {
                this.clocks[0].pause(false);
                this.clocks[1].pause(false);
                this.result = msg.result;
                this.status = msg.status;
                switch (msg.result) {
                    case "1/2-1/2":
                        sound_1.sound.draw();
                        break;
                    case "1-0":
                        if (!this.spectator) {
                            if (this.mycolor === "white") {
                                sound_1.sound.victory();
                            }
                            else {
                                sound_1.sound.defeat();
                            }
                        }
                        break;
                    case "0-1":
                        if (!this.spectator) {
                            if (this.mycolor === "black") {
                                sound_1.sound.victory();
                            }
                            else {
                                sound_1.sound.defeat();
                            }
                        }
                        break;
                    // ABORTED
                    default:
                        break;
                }
                this.gameOver();
                var container = document.getElementById('under-board');
                patch(container, h_1.h('under-board', [h_1.h('textarea', { attrs: { rows: 13 } }, msg.pgn)]));
                if (this.tv) {
                    setInterval(() => { this.doSend({ type: "updateTV", gameId: this.model["gameId"] }); }, 2000);
                }
            }
        };
        this.onMsgUpdateTV = (msg) => {
            if (msg.gameId !== this.model["gameId"]) {
                window.location.assign(this.model["home"] + '/tv');
            }
        };
        this.setPieces = (color) => {
            console.log("setPieces()", this.variant, color);
            var idx = this.CSSindexes[chess_1.variants.indexOf(this.variant)];
            idx = Math.min(idx, chess_1.VARIANTS[this.variant].css.length - 1);
            switch (this.variant) {
                case "capahouse":
                case "capablanca":
                case "seirawan":
                case "shouse":
                case "xiangqi":
                    sound_1.changeCSS('/static/' + chess_1.VARIANTS[this.variant].css[idx] + '.css');
                    break;
                case "shogi":
                    var css = chess_1.VARIANTS[this.variant].css[idx];
                    // change shogi piece colors according to board orientation
                    if (color === "black")
                        css = css.replace('0', '1');
                    sound_1.changeCSS('/static/' + css + '.css');
                    break;
            }
        };
        this.onMsgBoard = (msg) => {
            if (msg.gameId !== this.model["gameId"])
                return;
            // Game aborted.
            if (msg["status"] === 0)
                return;
            // console.log("got board msg:", msg);
            this.ply = msg.ply;
            this.fullfen = msg.fen;
            this.dests = msg.dests;
            const clocks = msg.clocks;
            const parts = msg.fen.split(" ");
            this.turnColor = parts[1] === "w" ? "white" : "black";
            if (msg.steps.length > 1) {
                this.steps = [];
                var container = document.getElementById('movelist');
                patch(container, h_1.h('div#movelist'));
                msg.steps.forEach((step) => {
                    this.steps.push(step);
                    movelist_1.updateMovelist(this);
                });
            }
            else {
                if (msg.ply === this.steps.length) {
                    const step = {
                        'fen': msg.fen,
                        'move': msg.lastMove[0] + msg.lastMove[1],
                        'check': msg.check,
                        'turnColor': this.turnColor,
                        'san': msg.steps[0].san,
                    };
                    this.steps.push(step);
                    movelist_1.updateMovelist(this);
                }
            }
            this.abortable = Number(parts[parts.length - 1]) <= 1;
            if (!this.spectator && !this.abortable && this.result === "") {
                var container = document.getElementById('abort');
                patch(container, h_1.h('button#abort', { props: { disabled: true } }));
            }
            var lastMove = msg.lastMove;
            if (lastMove !== null && this.variant === "shogi") {
                lastMove = chess_1.usi2uci(lastMove[0] + lastMove[1]);
                lastMove = [lastMove.slice(0, 2), lastMove.slice(2, 4)];
            }
            // drop lastMove causing scrollbar flicker,
            // so we remove from part to avoid that
            if (lastMove !== null && lastMove[0][1] === '@')
                lastMove = [lastMove[1]];
            // save capture state before updating chessground
            const capture = lastMove !== null && this.chessground.state.pieces[lastMove[1]];
            if (lastMove !== null && (this.turnColor === this.mycolor || this.spectator)) {
                if (this.variant === "shogi") {
                    sound_1.sound.shogimove();
                }
                else {
                    if (capture) {
                        sound_1.sound.capture();
                    }
                    else {
                        sound_1.sound.move();
                    }
                }
            }
            else {
                lastMove = [];
            }
            this.checkStatus(msg);
            if (msg.check) {
                sound_1.sound.check();
            }
            const oppclock = !this.flip ? 0 : 1;
            const myclock = 1 - oppclock;
            if (this.spectator) {
                this.chessground.set({
                    fen: parts[0],
                    turnColor: this.turnColor,
                    check: msg.check,
                    lastMove: lastMove,
                });
                pocket_1.updatePockets(this, this.vpocket0, this.vpocket1);
                this.clocks[0].pause(false);
                this.clocks[1].pause(false);
                this.clocks[oppclock].setTime(clocks[this.oppcolor]);
                this.clocks[myclock].setTime(clocks[this.mycolor]);
                if (!this.abortable && msg.status < 0) {
                    if (this.turnColor === this.mycolor) {
                        this.clocks[myclock].start();
                    }
                    else {
                        this.clocks[oppclock].start();
                    }
                }
            }
            else {
                if (this.turnColor === this.mycolor) {
                    this.chessground.set({
                        fen: parts[0],
                        turnColor: this.turnColor,
                        movable: {
                            free: false,
                            color: this.mycolor,
                            dests: msg.dests,
                        },
                        check: msg.check,
                        lastMove: lastMove,
                    });
                    pocket_1.updatePockets(this, this.vpocket0, this.vpocket1);
                    this.clocks[oppclock].pause(false);
                    this.clocks[oppclock].setTime(clocks[this.oppcolor]);
                    this.clocks[myclock].setTime(clocks[this.mycolor]);
                    if (!this.abortable && msg.status < 0) {
                        this.clocks[myclock].start(clocks[this.mycolor]);
                        console.log('MY CLOCK STARTED');
                    }
                    // console.log("trying to play premove....");
                    if (this.premove)
                        this.performPremove();
                    if (this.predrop)
                        this.performPredrop();
                }
                else {
                    this.chessground.set({
                        // giving fen here will place castling rooks to their destination in chess960 variants
                        fen: parts[0],
                        turnColor: this.turnColor,
                        premovable: {
                            dests: msg.dests,
                        },
                        check: msg.check,
                    });
                    this.clocks[myclock].pause(false);
                    this.clocks[myclock].setTime(clocks[this.mycolor]);
                    this.clocks[oppclock].setTime(clocks[this.oppcolor]);
                    if (!this.abortable && msg.status < 0) {
                        this.clocks[oppclock].start(clocks[this.oppcolor]);
                        console.log('OPP CLOCK  STARTED');
                    }
                    if (this.oppIsRandomMover && msg.rm !== "") {
                        this.doSend({ type: "move", gameId: this.model["gameId"], move: msg.rm, clocks: clocks });
                    }
                    ;
                }
                ;
            }
            ;
        };
        this.goPly = (ply) => {
            const step = this.steps[ply];
            var move = step.move;
            if (move !== undefined) {
                if (this.variant === "shogi")
                    move = chess_1.usi2uci(move);
                move = move.slice(1, 2) === '@' ? [move.slice(2, 4)] : [move.slice(0, 2), move.slice(2, 4)];
            }
            this.chessground.set({
                fen: step.fen,
                turnColor: step.turnColor,
                movable: {
                    free: false,
                    color: this.spectator ? undefined : step.turnColor,
                    dests: this.result === "" && ply === this.steps.length - 1 ? this.dests : undefined,
                },
                check: step.check,
                lastMove: move,
            });
            this.fullfen = step.fen;
            pocket_1.updatePockets(this, this.vpocket0, this.vpocket1);
            // TODO: play sound if ply == this.ply + 1
            this.ply = ply;
        };
        this.doSend = (message) => {
            console.log("---> doSend():", message);
            this.sock.send(JSON.stringify(message));
        };
        this.sendMove = (orig, dest, promo) => {
            // pause() will add increment!
            const oppclock = !this.flip ? 0 : 1;
            const myclock = 1 - oppclock;
            const movetime = (this.clocks[myclock].running) ? Date.now() - this.clocks[myclock].startTime : 0;
            this.clocks[myclock].pause((this.base === 0 && this.ply < 2) ? false : true);
            // console.log("sendMove(orig, dest, prom)", orig, dest, promo);
            const uci_move = orig + dest + promo;
            const move = this.variant === "shogi" ? chess_1.uci2usi(uci_move) : uci_move;
            // console.log("sendMove(move)", move);
            // TODO: if premoved, send 0 time
            let bclock, clocks;
            if (!this.flip) {
                bclock = this.mycolor === "black" ? 1 : 0;
            }
            else {
                bclock = this.mycolor === "black" ? 0 : 1;
            }
            const wclock = 1 - bclock;
            clocks = { movetime: movetime, black: this.clocks[bclock].duration, white: this.clocks[wclock].duration };
            this.doSend({ type: "move", gameId: this.model["gameId"], move: move, clocks: clocks });
            if (!this.abortable)
                this.clocks[oppclock].start();
        };
        this.onMove = () => {
            return (orig, dest, capturedPiece) => {
                console.log("   ground.onMove()", orig, dest, capturedPiece);
                if (this.variant === "shogi") {
                    sound_1.sound.shogimove();
                }
                else {
                    if (capturedPiece) {
                        sound_1.sound.capture();
                    }
                    else {
                        sound_1.sound.move();
                    }
                }
            };
        };
        this.onDrop = () => {
            return (piece, dest) => {
                console.log("ground.onDrop()", piece, dest);
                if (dest != "a0" && piece.role && pocket_1.dropIsValid(this.dests, piece.role, dest)) {
                    if (this.variant === "shogi") {
                        sound_1.sound.shogimove();
                    }
                    else {
                        sound_1.sound.move();
                    }
                }
                else {
                    this.clickDrop = piece;
                }
            };
        };
        this.setPremove = (orig, dest, meta) => {
            this.premove = { orig, dest, meta };
            console.log("setPremove() to:", orig, dest, meta);
        };
        this.unsetPremove = () => {
            this.premove = null;
        };
        this.setPredrop = (role, key) => {
            this.predrop = { role, key };
            console.log("setPredrop() to:", role, key);
        };
        this.unsetPredrop = () => {
            this.predrop = null;
        };
        this.performPremove = () => {
            const { orig, dest, meta } = this.premove;
            // TODO: promotion?
            console.log("performPremove()", orig, dest, meta);
            this.chessground.playPremove();
            this.premove = null;
        };
        this.performPredrop = () => {
            const { role, key } = this.predrop;
            console.log("performPredrop()", role, key);
            this.chessground.playPredrop(drop => { return pocket_1.dropIsValid(this.dests, drop.role, drop.key); });
            this.predrop = null;
        };
        this.onUserMove = (orig, dest, meta) => {
            // chessground doesn't knows about ep, so we have to remove ep captured pawn
            const pieces = this.chessground.state.pieces;
            const geom = this.chessground.state.geometry;
            console.log("ground.onUserMove()", orig, dest, meta, pieces);
            const moved = pieces[dest];
            const firstRankIs0 = this.chessground.state.dimensions.height === 10;
            if (meta.captured === undefined && moved.role === "pawn" && orig[0] != dest[0] && chess_1.hasEp(this.variant)) {
                const pos = util_1.key2pos(dest, firstRankIs0), pawnPos = [pos[0], pos[1] + (this.mycolor === 'white' ? -1 : 1)];
                const diff = {};
                diff[util_1.pos2key(pawnPos, geom)] = undefined;
                this.chessground.setPieces(diff);
                meta.captured = { role: "pawn" };
            }
            ;
            // increase pocket count
            if ((this.variant === "crazyhouse" || this.variant === "capahouse" || this.variant === "shouse" || this.variant === "shogi") && meta.captured) {
                var role = meta.captured.role;
                if (meta.captured.promoted)
                    role = this.variant === "shogi" ? meta.captured.role.slice(1) : "pawn";
                if (this.flip) {
                    this.pockets[0][role]++;
                    this.vpocket0 = patch(this.vpocket0, pocket_1.pocketView(this, this.mycolor, "top"));
                }
                else {
                    this.pockets[1][role]++;
                    this.vpocket1 = patch(this.vpocket1, pocket_1.pocketView(this, this.mycolor, "bottom"));
                }
            }
            ;
            //  gating elephant/hawk
            if (this.variant === "seirawan" || this.variant === "shouse") {
                if (!this.promotion.start(orig, dest, meta) && !this.gating.start(this.fullfen, orig, dest, meta))
                    this.sendMove(orig, dest, '');
            }
            else {
                if (!this.promotion.start(orig, dest, meta))
                    this.sendMove(orig, dest, '');
            }
            ;
        };
        this.onUserDrop = (role, dest) => {
            // console.log("ground.onUserDrop()", role, dest);
            // decrease pocket count
            if (pocket_1.dropIsValid(this.dests, role, dest)) {
                if (this.flip) {
                    this.pockets[0][role]--;
                    this.vpocket0 = patch(this.vpocket0, pocket_1.pocketView(this, this.mycolor, "top"));
                }
                else {
                    this.pockets[1][role]--;
                    this.vpocket1 = patch(this.vpocket1, pocket_1.pocketView(this, this.mycolor, "bottom"));
                }
                this.sendMove(chess_1.roleToSan[role] + "@", dest, '');
                // console.log("sent move", move);
            }
            else {
                console.log("!!! invalid move !!!", role, dest);
                // restore board
                this.clickDrop = undefined;
                this.chessground.set({
                    fen: this.fullfen,
                    lastMove: this.lastmove,
                    turnColor: this.mycolor,
                    movable: {
                        dests: this.dests,
                        showDests: true,
                    },
                });
            }
        };
        // use this for sittuyin in place promotion ?
        // Or implement ondblclick handler to emit move in chessground?
        // https://www.w3schools.com/jsref/event_ondblclick.asp
        this.onChange = (selected) => {
            return () => {
                console.log("   ground.onChange()", selected);
            };
        };
        // use this for sittuyin in place promotion ?
        this.onSelect = (selected) => {
            return (key) => {
                console.log("   ground.onSelect()", key, selected, this.clickDrop, this.chessground.state);
                // If drop selection was set dropDests we have to restore dests here
                if (this.chessground.state.movable.dests === undefined)
                    return;
                if (key != "a0" && "a0" in this.chessground.state.movable.dests) {
                    if (this.clickDrop !== undefined && pocket_1.dropIsValid(this.dests, this.clickDrop.role, key)) {
                        this.chessground.newPiece(this.clickDrop, key);
                        this.onUserDrop(this.clickDrop.role, key);
                    }
                    this.clickDrop = undefined;
                    this.chessground.set({ movable: { dests: this.dests } });
                }
                ;
            };
        };
        this.onMsgUserConnected = (msg) => {
            this.model["username"] = msg["username"];
            user_1.renderUsername(this.model["home"], this.model["username"]);
            if (this.spectator) {
                this.doSend({ type: "is_user_online", username: this.wplayer });
                this.doSend({ type: "is_user_online", username: this.bplayer });
                // we want to know lastMove and check status
                this.doSend({ type: "board", gameId: this.model["gameId"] });
            }
            else {
                const opp_name = this.model["username"] === this.wplayer ? this.bplayer : this.wplayer;
                this.doSend({ type: "is_user_online", username: opp_name });
                var container = document.getElementById('bottom-player');
                patch(container, h_1.h('i-side.online#bottom-player', { class: { "icon": true, "icon-online": true, "icon-offline": false } }));
                // prevent sending gameStart message when user just reconecting
                if (msg.ply === 0) {
                    this.doSend({ type: "ready", gameId: this.model["gameId"] });
                }
                this.doSend({ type: "board", gameId: this.model["gameId"] });
            }
        };
        this.onMsgUserOnline = (msg) => {
            console.log(msg);
            if (msg.username === this.players[0]) {
                var container = document.getElementById('top-player');
                patch(container, h_1.h('i-side.online#top-player', { class: { "icon": true, "icon-online": true, "icon-offline": false } }));
            }
            else {
                var container = document.getElementById('bottom-player');
                patch(container, h_1.h('i-side.online#bottom-player', { class: { "icon": true, "icon-online": true, "icon-offline": false } }));
            }
        };
        this.onMsgUserDisconnected = (msg) => {
            console.log(msg);
            if (msg.username === this.players[0]) {
                var container = document.getElementById('top-player');
                patch(container, h_1.h('i-side.online#top-player', { class: { "icon": true, "icon-online": false, "icon-offline": true } }));
            }
            else {
                var container = document.getElementById('bottom-player');
                patch(container, h_1.h('i-side.online#bottom-player', { class: { "icon": true, "icon-online": false, "icon-offline": true } }));
            }
        };
        this.onMsgChat = (msg) => {
            if (msg.user !== this.model["username"])
                chat_1.chatMessage(msg.user, msg.message, "roundchat");
        };
        this.onMsgMoreTime = () => {
            chat_1.chatMessage('', this.mycolor + ' +15 seconds', "roundchat");
            this.clocks[1].setTime(this.clocks[1].duration + 15 * 1000);
        };
        this.onMsgOffer = (msg) => {
            chat_1.chatMessage("", msg.message, "roundchat");
        };
        this.onMessage = (evt) => {
            console.log("<+++ onMessage():", evt.data);
            var msg = JSON.parse(evt.data);
            switch (msg.type) {
                case "board":
                    this.onMsgBoard(msg);
                    break;
                case "gameEnd":
                    this.checkStatus(msg);
                    break;
                case "gameStart":
                    this.onMsgGameStart(msg);
                    break;
                case "game_user_connected":
                    this.onMsgUserConnected(msg);
                    break;
                case "user_online":
                    this.onMsgUserOnline(msg);
                    break;
                case "user_disconnected":
                    this.onMsgUserDisconnected(msg);
                    break;
                case "roundchat":
                    this.onMsgChat(msg);
                    break;
                case "new_game":
                    this.onMsgNewGame(msg);
                    break;
                case "offer":
                    this.onMsgOffer(msg);
                    break;
                case "moretime":
                    this.onMsgMoreTime();
                    break;
                case "updateTV":
                    this.onMsgUpdateTV(msg);
                    break;
            }
        };
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
                var container = document.getElementById('bottom-player');
                patch(container, h_1.h('i-side.online#bottom-player', { class: { "icon": true, "icon-online": false, "icon-offline": true } }));
            },
            onmaximum: e => console.log('Stop Attempting!', e),
            onclose: e => console.log('Closed!', e),
            onerror: e => console.log('Error:', e),
        };
        try {
            this.sock = new sockette_1.default("ws://" + location.host + "/wsr", opts);
        }
        catch (err) {
            this.sock = new sockette_1.default("wss://" + location.host + "/wsr", opts);
        }
        this.model = model;
        this.variant = model["variant"];
        this.fullfen = model["fen"];
        this.wplayer = model["wplayer"];
        this.bplayer = model["bplayer"];
        this.base = model["base"];
        this.inc = model["inc"];
        this.status = model["status"];
        this.tv = model["tv"];
        this.steps = [];
        this.ply = 0;
        this.flip = false;
        this.CSSindexes = chess_1.variants.map((variant) => localStorage[variant + "_pieces"] === undefined ? 0 : Number(localStorage[variant + "_pieces"]));
        this.spectator = this.model["username"] !== this.wplayer && this.model["username"] !== this.bplayer;
        // orientation = this.mycolor
        if (this.spectator) {
            this.mycolor = this.variant === 'shogi' ? 'black' : 'white';
            this.oppcolor = this.variant === 'shogi' ? 'white' : 'black';
        }
        else {
            this.mycolor = this.model["username"] === this.wplayer ? 'white' : 'black';
            this.oppcolor = this.model["username"] === this.wplayer ? 'black' : 'white';
        }
        this.oppIsRandomMover = ((this.mycolor === "white" && this.bplayer === "Random-Mover") ||
            (this.mycolor === "black" && this.wplayer === "Random-Mover"));
        // players[0] is top player, players[1] is bottom player
        this.players = [
            this.mycolor === "white" ? this.bplayer : this.wplayer,
            this.mycolor === "white" ? this.wplayer : this.bplayer
        ];
        this.premove = null;
        this.predrop = null;
        this.result = "";
        const parts = this.fullfen.split(" ");
        this.abortable = Number(parts[parts.length - 1]) <= 1;
        const fen_placement = parts[0];
        this.turnColor = parts[1] === "w" ? "white" : "black";
        if (chess_1.VARIANTS[this.variant].css.length > 1) {
            this.setPieces(this.mycolor);
        }
        else {
            sound_1.changeCSS('/static/' + chess_1.VARIANTS[this.variant].css[0] + '.css');
        }
        ;
        this.steps.push({
            'fen': fen_placement,
            'move': undefined,
            'check': false,
            'turnColor': this.turnColor,
        });
        this.chessground = chessgroundx_1.Chessground(el, {
            fen: fen_placement,
            geometry: chess_1.VARIANTS[this.variant].geom,
            orientation: this.mycolor,
            turnColor: this.turnColor,
            animation: {
                enabled: true,
            },
            events: {
                insert(elements) { resize_1.default(elements); }
            }
        });
        if (localStorage.zoom !== undefined && localStorage.zoom !== 100) {
            this.setZoom(Number(localStorage.zoom));
        }
        if (this.spectator) {
            this.chessground.set({
                viewOnly: true,
                events: {
                    move: this.onMove(),
                }
            });
        }
        else {
            this.chessground.set({
                movable: {
                    free: false,
                    color: this.mycolor,
                    showDests: true,
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
                    change: this.onChange(this.chessground.state.selected),
                    select: this.onSelect(this.chessground.state.selected),
                }
            });
        }
        ;
        this.gating = gating_1.default(this);
        this.promotion = promotion_1.default(this);
        // initialize pockets
        if (chess_1.needPockets(this.variant)) {
            const pocket0 = document.getElementById('pocket0');
            const pocket1 = document.getElementById('pocket1');
            pocket_1.updatePockets(this, pocket0, pocket1);
        }
        // initialize clocks
        const c0 = new clock_1.Clock(this.base, this.inc, document.getElementById('clock0'), 'clock0');
        const c1 = new clock_1.Clock(this.base, this.inc, document.getElementById('clock1'), 'clock1');
        this.clocks = [c0, c1];
        this.clocks[0].onTick(clock_1.renderTime);
        this.clocks[1].onTick(clock_1.renderTime);
        const onMoreTime = () => {
            if (this.model['wtitle'] === 'BOT' || this.model['btitle'] === 'BOT' || this.spectator)
                return;
            this.clocks[0].setTime(this.clocks[0].duration + 15 * 1000);
            this.doSend({ type: "moretime", gameId: this.model["gameId"] });
            chat_1.chatMessage('', this.oppcolor + ' +15 seconds', "roundchat");
        };
        var container = document.getElementById('clock0');
        patch(container, h_1.h('div.clock-wrap#clock0', [
            h_1.h('div.more-time', [
                h_1.h('button.icon.icon-plus-square', {
                    props: { type: "button", title: "Give 15 seconds" },
                    on: { click: () => onMoreTime() }
                })
            ])
        ]));
        const flagCallback = () => {
            if (this.turnColor === this.mycolor && !this.spectator) {
                this.chessground.stop();
                console.log("Flag");
                this.doSend({ type: "flag", gameId: this.model["gameId"] });
            }
        };
        this.clocks[1].onFlag(flagCallback);
        if (Number(this.status) < 0) {
            console.log("GAME is ONGOING...");
        }
        else {
            console.log("GAME was ENDED...");
        }
        // TODO: add dark/light theme buttons (icon-sun-o/icon-moon-o)
        const togglePieces = () => {
            var idx = this.CSSindexes[chess_1.variants.indexOf(this.variant)];
            idx += 1;
            idx = idx % chess_1.VARIANTS[this.variant].css.length;
            this.CSSindexes[chess_1.variants.indexOf(this.variant)] = idx;
            localStorage.setItem(this.variant + "_pieces", String(idx));
            this.setPieces(this.mycolor);
        };
        if (chess_1.VARIANTS[this.variant].css.length > 1) {
            var container = document.getElementById('btn-pieces');
            patch(container, h_1.h('button', { on: { click: () => togglePieces() }, props: { title: 'Toggle pieces' } }, [h_1.h('i', { class: { "icon": true, "icon-cog": true } }),]));
        }
        var container = document.getElementById('zoom');
        patch(container, h_1.h('input', { class: { "slider": true },
            attrs: { width: '280px', type: 'range', value: Number(localStorage.zoom), min: 60, max: 140 },
            on: { input: (e) => { this.setZoom(parseFloat(e.target.value)); } } }));
        //const onResize = () => {console.log("onResize()");}
        //var elmnt = document.getElementById('cgwrap') as HTMLElement;
        //elmnt.addEventListener("resize", onResize);
        const abort = () => {
            console.log("Abort");
            this.doSend({ type: "abort", gameId: this.model["gameId"] });
        };
        const draw = () => {
            console.log("Draw");
            this.doSend({ type: "draw", gameId: this.model["gameId"] });
        };
        const resign = () => {
            console.log("Resign");
            this.doSend({ type: "resign", gameId: this.model["gameId"] });
        };
        var container = document.getElementById('game-controls');
        if (!this.spectator) {
            this.gameControls = patch(container, h_1.h('div.btn-controls', [
                h_1.h('button#abort', { on: { click: () => abort() }, props: { title: 'Abort' } }, [h_1.h('i', { class: { "icon": true, "icon-abort": true } }),]),
                h_1.h('button#draw', { on: { click: () => draw() }, props: { title: "Draw" } }, [h_1.h('i', { class: { "icon": true, "icon-hand-paper-o": true } }),]),
                h_1.h('button#resign', { on: { click: () => resign() }, props: { title: "Resign" } }, [h_1.h('i', { class: { "icon": true, "icon-flag-o": true } }),]),
            ]));
        }
        else {
            this.gameControls = patch(container, h_1.h('div'));
        }
        patch(document.getElementById('movelist'), movelist_1.movelistView(this));
        patch(document.getElementById('roundchat'), chat_1.chatView(this, "roundchat"));
        // this produces random losed games while doing nothing
        //        window.addEventListener('beforeunload', () => {
        //            if (this.result === '') this.doSend({ type: "abandone", gameId: this.model["gameId"] });
        //        });
    }
}
exports.default = RoundController;

},{"./chat":32,"./chess":33,"./clock":34,"./gating":36,"./movelist":39,"./pocket":41,"./profile":42,"./promotion":43,"./resize":44,"./sound":46,"./user":47,"chessgroundx":4,"chessgroundx/types":16,"chessgroundx/util":17,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25,"sockette":30}],36:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const tovnode_1 = __importDefault(require("snabbdom/tovnode"));
const util_1 = require("chessgroundx/util");
const chess_1 = require("./chess");
const pocket_1 = require("./pocket");
const patch = snabbdom_1.init([class_1.default, attributes_1.default, eventlisteners_1.default]);
function default_1(ctrl) {
    let gating = false;
    let roles;
    function start(fen, orig, dest, meta) {
        const ground = ctrl.getGround();
        const gatable = chess_1.canGate(fen, ground.state.pieces[dest], orig, dest, meta);
        roles = ["hawk", "elephant", "queen", "rook", "bishop", "knight", ""];
        if (gatable[0] || gatable[1] || gatable[2] || gatable[3] || gatable[4] || gatable[5]) {
            const color = ctrl.mycolor;
            const orientation = ground.state.orientation;
            if (roles.indexOf("hawk") !== -1 && !gatable[0])
                roles.splice(roles.indexOf("hawk"), 1);
            if (roles.indexOf("elephant") !== -1 && !gatable[1])
                roles.splice(roles.indexOf("elephant"), 1);
            if (roles.indexOf("queen") !== -1 && !gatable[2])
                roles.splice(roles.indexOf("queen"), 1);
            if (roles.indexOf("rook") !== -1 && !gatable[3])
                roles.splice(roles.indexOf("rook"), 1);
            if (roles.indexOf("bishop") !== -1 && !gatable[4])
                roles.splice(roles.indexOf("bishop"), 1);
            if (roles.indexOf("knight") !== -1 && !gatable[5])
                roles.splice(roles.indexOf("knight"), 1);
            var origs = [orig];
            const castling = ground.state.pieces[dest].role === "king" && orig[0] === "e" && dest[0] !== "d" && dest[0] !== "e" && dest[0] !== "f";
            var rookDest = "";
            if (castling) {
                // O-O
                if (dest[0] > "e") {
                    origs.push("h" + orig[1]);
                    rookDest = "e" + orig[1];
                    // O-O-O
                }
                else {
                    origs.push("a" + orig[1]);
                    rookDest = "e" + orig[1];
                }
                ;
            }
            ;
            draw_gating(origs, color, orientation);
            gating = {
                origs: origs,
                dest: dest,
                rookDest: rookDest,
                callback: ctrl.sendMove,
            };
            return true;
        }
        return false;
    }
    ;
    function gate(ctrl, orig, dest, role) {
        const g = ctrl.getGround();
        const color = g.state.pieces[dest].color;
        g.newPiece({ "role": role, "color": color }, orig);
        ctrl.pockets[color === 'white' ? 0 : 1][role]--;
        ctrl.vpocket1 = patch(ctrl.vpocket1, pocket_1.pocketView(ctrl, color, "bottom"));
    }
    function draw_gating(origs, color, orientation) {
        var container = tovnode_1.default(document.querySelector('extension'));
        patch(container, renderGating(origs, color, orientation));
    }
    function draw_no_gating() {
        var container = document.getElementById('extension_choice');
        patch(container, snabbdom_1.h('extension'));
    }
    function finish(role, index) {
        if (gating) {
            draw_no_gating();
            if (role)
                gate(ctrl, gating.origs[index], gating.dest, role);
            else
                index = 0;
            const gated = role ? chess_1.roleToSan[role].toLowerCase() : "";
            if (gating.callback)
                gating.callback(gating.origs[index], index === 0 ? gating.dest : gating.rookDest, gated);
            gating = false;
        }
    }
    ;
    function cancel() {
        console.log("CANCEL gating");
        return;
    }
    function bind(eventName, f, redraw) {
        return {
            insert(vnode) {
                vnode.elm.addEventListener(eventName, e => {
                    const res = f(e);
                    if (redraw)
                        redraw();
                    return res;
                });
            }
        };
    }
    function renderSquares(orig, color, orientation, index) {
        const firstRankIs0 = false;
        var left = (8 - util_1.key2pos(orig, firstRankIs0)[0]) * 12.5;
        if (orientation === "white")
            left = 87.5 - left;
        return roles.map((serverRole, i) => {
            var top = (color === orientation ? 7 - i : i) * 12.5;
            return snabbdom_1.h("square", {
                attrs: { style: "top: " + top + "%;left: " + left + "%" },
                hook: bind("click", e => {
                    e.stopPropagation();
                    finish(serverRole, index);
                }, false)
            }, [snabbdom_1.h("piece." + serverRole + "." + color)]);
        });
    }
    function renderGating(origs, color, orientation) {
        var vertical = color === orientation ? "top" : "bottom";
        var squares = renderSquares(origs[0], color, orientation, 0);
        if (origs.length > 1)
            squares = squares.concat(renderSquares(origs[1], color, orientation, 1));
        return snabbdom_1.h("div#extension_choice." + vertical, {
            hook: {
                insert: vnode => {
                    const el = vnode.elm;
                    el.addEventListener("click", () => cancel());
                    el.addEventListener("contextmenu", e => {
                        e.preventDefault();
                        return false;
                    });
                }
            }
        }, squares);
    }
    return {
        start,
    };
}
exports.default = default_1;

},{"./chess":33,"./pocket":41,"chessgroundx/util":17,"snabbdom":26,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/tovnode":28}],37:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sockette_1 = __importDefault(require("sockette"));
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
const user_1 = require("./user");
const chat_1 = require("./chat");
const chess_1 = require("./chess");
class LobbyController {
    constructor(el, model) {
        this.onMsgGetSeeks = (msg) => {
            this.seeks = msg.seeks;
            // console.log("!!!! got get_seeks msg:", msg);
            const oldVNode = document.getElementById('seeks');
            if (oldVNode instanceof Element) {
                oldVNode.innerHTML = '';
                patch(oldVNode, h_1.default('table#seeks', this.renderSeeks(msg.seeks)));
            }
        };
        this.onMsgNewGame = (msg) => {
            console.log("LobbyController.onMsgNewGame()", this.model["gameId"]);
            window.location.assign(this.model["home"] + '/' + msg["gameId"]);
        };
        this.onMsgUserConnected = (msg) => {
            this.model["username"] = msg["username"];
            user_1.renderUsername(this.model["home"], this.model["username"]);
        };
        this.onMsgChat = (msg) => {
            if (msg.user !== this.model["username"])
                chat_1.chatMessage(msg.user, msg.message, "lobbychat");
        };
        this.onMsgFullChat = (msg) => {
            msg.lines.forEach((line) => { chat_1.chatMessage(line.user, line.message, "lobbychat"); });
        };
        this.onMsgPing = (msg) => {
            this.doSend({ type: "pong", timestamp: msg.timestamp });
        };
        this.onMsgShutdown = (msg) => {
            alert(msg.message);
        };
        console.log("LobbyController constructor", el, model);
        this.model = model;
        this.challengeAI = false;
        const onOpen = (evt) => {
            this._ws = evt.target;
            console.log("---CONNECTED", evt);
            this.doSend({ type: "lobby_user_connected", username: this.model["username"] });
            this.doSend({ type: "get_seeks" });
        };
        this._ws = { "readyState": -1 };
        const opts = {
            maxAttempts: 20,
            onopen: e => onOpen(e),
            onmessage: e => this.onMessage(e),
            onreconnect: e => console.log('Reconnecting in lobby...', e),
            onmaximum: e => console.log('Stop Attempting!', e),
            onclose: e => { console.log('Closed!', e); },
            onerror: e => console.log('Error:', e),
        };
        try {
            this.sock = new sockette_1.default("ws://" + location.host + "/wsl", opts);
        }
        catch (err) {
            this.sock = new sockette_1.default("wss://" + location.host + "/wsl", opts);
        }
        // get seeks when we are coming back after a game
        if (this._ws.readyState === 1) {
            this.doSend({ type: "get_seeks" });
        }
        ;
        patch(document.getElementById('seekbuttons'), h_1.default('ul#seekbuttons', this.renderSeekButtons()));
        patch(document.getElementById('lobbychat'), chat_1.chatView(this, "lobbychat"));
    }
    doSend(message) {
        console.log("---> lobby doSend():", message);
        this.sock.send(JSON.stringify(message));
    }
    createSeekMsg(variant, color, fen, minutes, increment, chess960) {
        this.doSend({
            type: "create_seek",
            user: this.model["username"],
            variant: variant,
            fen: fen,
            minutes: minutes,
            increment: increment,
            rated: false,
            chess960: chess960,
            color: color
        });
    }
    createBotChallengeMsg(variant, color, fen, minutes, increment, level, chess960) {
        this.doSend({
            type: "create_ai_challenge",
            user: this.model["username"],
            variant: variant,
            fen: fen,
            minutes: minutes,
            increment: increment,
            rated: false,
            level: level,
            chess960: chess960,
            color: color
        });
    }
    isNewSeek(variant, color, fen, minutes, increment) {
        return !this.seeks.some(seek => {
            return seek.user === this.model["username"] && seek.variant === variant && seek.fen === fen && seek.color === color && seek.tc === minutes + "+" + increment;
        });
    }
    createSeek(color) {
        document.getElementById('id01').style.display = 'none';
        let e;
        e = document.getElementById('variant');
        const variant = e.options[e.selectedIndex].value;
        localStorage.setItem("seek_variant", variant);
        e = document.getElementById('fen');
        const fen = e.value;
        localStorage.setItem("seek_fen", e.value);
        e = document.getElementById('min');
        const minutes = parseInt(e.value);
        localStorage.setItem("seek_min", e.value);
        e = document.getElementById('inc');
        const increment = parseInt(e.value);
        localStorage.setItem("seek_inc", e.value);
        e = document.getElementById('chess960');
        const hide = chess_1.variants960.indexOf(variant) === -1;
        const chess960 = (hide) ? false : e.checked;
        console.log("CREATE SEEK variant, color, fen, minutes, increment, hide, chess960", variant, color, fen, minutes, increment, hide, chess960);
        localStorage.setItem("seek_chess960", e.checked);
        if (this.challengeAI) {
            e = document.querySelector('input[name="level"]:checked');
            const level = parseInt(e.value);
            localStorage.setItem("seek_level", e.value);
            console.log(level, e.value, localStorage.getItem("seek_level"));
            this.createBotChallengeMsg(variant, color, fen, minutes, increment, level, chess960);
        }
        else {
            if (this.isNewSeek(variant, color, fen, minutes, increment)) {
                this.createSeekMsg(variant, color, fen, minutes, increment, chess960);
            }
        }
    }
    renderSeekButtons() {
        const setVariant = () => {
            let e;
            e = document.getElementById('variant');
            const variant = e.options[e.selectedIndex].value;
            const hide = chess_1.variants960.indexOf(variant) === -1;
            document.getElementById('chess960-block').style.display = (hide) ? 'none' : 'block';
        };
        const setMinutes = (minutes) => {
            var min, inc = 0;
            var el = document.getElementById("minutes");
            if (el)
                el.innerHTML = minutes;
            var e = document.getElementById('min');
            if (e)
                min = parseInt(e.value);
            e = document.getElementById('inc');
            if (e)
                inc = parseInt(e.value);
            document.getElementById('color-button-group').style.display = (min + inc === 0) ? 'none' : 'block';
        };
        const setIncrement = (increment) => {
            var min, inc = 0;
            var el = document.getElementById("increment");
            if (el)
                el.innerHTML = increment;
            var e = document.getElementById('min');
            if (e)
                min = parseInt(e.value);
            e = document.getElementById('inc');
            if (e)
                inc = parseInt(e.value);
            document.getElementById('color-button-group').style.display = (min + inc === 0) ? 'none' : 'block';
        };
        const vIdx = localStorage.seek_variant === undefined ? 0 : chess_1.variants.indexOf(localStorage.seek_variant);
        const vFen = localStorage.seek_fen === undefined ? "" : localStorage.seek_fen;
        const vMin = localStorage.seek_min === undefined ? "5" : localStorage.seek_min;
        const vInc = localStorage.seek_inc === undefined ? "3" : localStorage.seek_inc;
        const vLevel = localStorage.seek_level === undefined ? "1" : localStorage.seek_level;
        const vChess960 = localStorage.seek_chess960 === undefined ? "false" : localStorage.seek_chess960;
        console.log("localeStorage.seek_level, vLevel=", localStorage.seek_level, vLevel);
        return [
            h_1.default('div#id01', { class: { "modal": true } }, [
                h_1.default('form.modal-content', [
                    h_1.default('div#closecontainer', [
                        h_1.default('span.close', { on: { click: () => document.getElementById('id01').style.display = 'none' }, attrs: { 'data-icon': 'j' }, props: { title: "Cancel" } }),
                    ]),
                    h_1.default('div.container', [
                        h_1.default('label', { attrs: { for: "variant" } }, "Variant"),
                        h_1.default('select#variant', {
                            props: { name: "variant" },
                            on: { input: () => setVariant() },
                            hook: { insert: () => setVariant() },
                        }, chess_1.variants.map((variant, idx) => h_1.default('option', { props: { value: variant, selected: (idx === vIdx) ? "selected" : "" } }, variant))),
                        h_1.default('label', { attrs: { for: "fen" } }, "Start position"),
                        h_1.default('input#fen', { props: { name: 'fen', placeholder: 'Paste the FEN text here', value: vFen } }),
                        h_1.default('div#chess960-block', [
                            h_1.default('label', { attrs: { for: "chess960" } }, "Chess960"),
                            h_1.default('input#chess960', { props: { name: "chess960", type: "checkbox", checked: vChess960 === "true" ? "checked" : "" } }),
                        ]),
                        //h('label', { attrs: {for: "tc"} }, "Time Control"),
                        //h('select#timecontrol', { props: {name: "timecontrol"} }, [
                        //    h('option', { props: {value: "1", selected: true} }, "Real time"),
                        //    h('option', { props: {value: "2"} }, "Unlimited"),
                        //]),
                        h_1.default('label', { attrs: { for: "min" } }, "Minutes per side:"),
                        h_1.default('span#minutes'),
                        h_1.default('input#min', { class: { "slider": true },
                            props: { name: "min", type: "range", min: 0, max: 60, value: vMin },
                            on: { input: (e) => setMinutes(e.target.value) },
                            hook: { insert: (vnode) => setMinutes(vnode.elm.value) },
                        }),
                        h_1.default('label', { attrs: { for: "inc" } }, "Increment in seconds:"),
                        h_1.default('span#increment'),
                        h_1.default('input#inc', { class: { "slider": true },
                            props: { name: "inc", type: "range", min: 0, max: 15, value: vInc },
                            on: { input: (e) => setIncrement(e.target.value) },
                            hook: { insert: (vnode) => setIncrement(vnode.elm.value) },
                        }),
                        // if play with the machine
                        // A.I.Level (1-8 buttons)
                        h_1.default('form#ailevel', [
                            h_1.default('h4', "A.I. Level"),
                            h_1.default('div.radio-group', [
                                h_1.default('input#ai1', { props: { type: "radio", name: "level", value: "1", checked: vLevel === "1" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai1', { attrs: { for: "ai1" } }, "1"),
                                h_1.default('input#ai2', { props: { type: "radio", name: "level", value: "2", checked: vLevel === "2" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai2', { attrs: { for: "ai2" } }, "2"),
                                h_1.default('input#ai3', { props: { type: "radio", name: "level", value: "3", checked: vLevel === "3" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai3', { attrs: { for: "ai3" } }, "3"),
                                h_1.default('input#ai4', { props: { type: "radio", name: "level", value: "4", checked: vLevel === "4" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai4', { attrs: { for: "ai4" } }, "4"),
                                h_1.default('input#ai5', { props: { type: "radio", name: "level", value: "5", checked: vLevel === "5" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai5', { attrs: { for: "ai5" } }, "5"),
                                h_1.default('input#ai6', { props: { type: "radio", name: "level", value: "6", checked: vLevel === "6" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai6', { attrs: { for: "ai6" } }, "6"),
                                h_1.default('input#ai7', { props: { type: "radio", name: "level", value: "7", checked: vLevel === "7" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai7', { attrs: { for: "ai7" } }, "7"),
                                h_1.default('input#ai8', { props: { type: "radio", name: "level", value: "8", checked: vLevel === "8" ? "checked" : "" } }),
                                h_1.default('label.level-ai.ai8', { attrs: { for: "ai8" } }, "8"),
                            ]),
                        ]),
                        h_1.default('div#color-button-group', [
                            h_1.default('button.icon.icon-black', { props: { type: "button", title: "Black" }, on: { click: () => this.createSeek('b') } }),
                            h_1.default('button.icon.icon-adjust', { props: { type: "button", title: "Random" }, on: { click: () => this.createSeek('r') } }),
                            h_1.default('button.icon.icon-white', { props: { type: "button", title: "White" }, on: { click: () => this.createSeek('w') } }),
                        ]),
                    ]),
                ]),
            ]),
            h_1.default('button', { class: { 'lobby-button': true }, on: {
                    click: () => {
                        this.challengeAI = false;
                        document.getElementById('ailevel').style.display = 'none';
                        document.getElementById('id01').style.display = 'block';
                    }
                } }, "Create a game"),
            h_1.default('button', { class: { 'lobby-button': true }, on: {
                    click: () => {
                        this.challengeAI = true;
                        document.getElementById('ailevel').style.display = 'inline-block';
                        document.getElementById('id01').style.display = 'block';
                    }
                } }, "Play with the machine"),
        ];
    }
    onClickSeek(seek) {
        if (seek["user"] === this.model["username"]) {
            this.doSend({ type: "delete_seek", seekID: seek["seekID"], player: this.model["username"] });
        }
        else {
            this.doSend({ type: "accept_seek", seekID: seek["seekID"], player: this.model["username"] });
        }
    }
    renderSeeks(seeks) {
        // TODO: fix header and data row colomns
        // https://stackoverflow.com/questions/37272331/html-table-with-fixed-header-and-footer-and-scrollable-body-without-fixed-widths
        const header = h_1.default('thead', [h_1.default('tr', [h_1.default('th', 'Player'),
                h_1.default('th', 'Color'),
                h_1.default('th', 'Rating'),
                h_1.default('th', 'Time'),
                h_1.default('th', '    '),
                h_1.default('th', 'Variant'),
                h_1.default('th', 'Mode')])]);
        const colorIcon = (color) => { return h_1.default('i', { attrs: { "data-icon": color === "w" ? "c" : color === "b" ? "b" : "a" } }); };
        var rows = seeks.map((seek) => h_1.default('tr', { on: { click: () => this.onClickSeek(seek) } }, [h_1.default('td', seek["user"]),
            h_1.default('td', [colorIcon(seek["color"])]),
            h_1.default('td', '1500?'),
            h_1.default('td', seek["tc"]),
            h_1.default('td', { attrs: { "data-icon": chess_1.VARIANTS[seek["variant"]].icon }, class: { "icon": true } }),
            h_1.default('td', { attrs: { "data-icon": (seek.chess960) ? "V" : "" }, class: { "icon": true } }),
            h_1.default('td', seek["variant"]),
            h_1.default('td', seek["rated"])]));
        return [header, h_1.default('tbody', rows)];
    }
    onMessage(evt) {
        console.log("<+++ lobby onMessage():", evt.data);
        var msg = JSON.parse(evt.data);
        switch (msg.type) {
            case "get_seeks":
                this.onMsgGetSeeks(msg);
                break;
            case "new_game":
                this.onMsgNewGame(msg);
                break;
            case "lobby_user_connected":
                this.onMsgUserConnected(msg);
                break;
            case "lobbychat":
                this.onMsgChat(msg);
                break;
            case "fullchat":
                this.onMsgFullChat(msg);
                break;
            case "ping":
                this.onMsgPing(msg);
                break;
            case "shutdown":
                this.onMsgShutdown(msg);
                break;
        }
    }
}
function runSeeks(vnode, model) {
    const el = vnode.elm;
    const ctrl = new LobbyController(el, model);
    console.log("lobbyView() -> runSeeks()", el, model, ctrl);
}
function lobbyView(model) {
    // Get the modal
    const modal = document.getElementById('id01');
    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
    return [h_1.default('aside.sidebar-first', [h_1.default('div.lobbychat#lobbychat')]),
        h_1.default('main.main', [h_1.default('table#seeks', { hook: { insert: (vnode) => runSeeks(vnode, model) } })]),
        h_1.default('aside.sidebar-second', [h_1.default('ul#seekbuttons')]),
        h_1.default('under-left', "# of users"),
        h_1.default('under-lobby'),
        h_1.default('under-right'),
    ];
}
exports.lobbyView = lobbyView;

},{"./chat":32,"./chess":33,"./user":47,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25,"sockette":30}],38:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const h_1 = __importDefault(require("snabbdom/h"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const lobby_1 = require("./lobby");
const round_1 = require("./round");
const players_1 = require("./players");
const profile_1 = require("./profile");
const about_1 = require("./about");
const model = { home: "", username: "", anon: "", variant: "", gameId: 0, wplayer: "", bplayer: "", fen: "", base: "", inc: "", seeks: [], tv: "", profileid: "", status: "" };
var getCookie = function (name) {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; ++i) {
        var pair = cookies[i].trim().split('=');
        if (pair[0] == name)
            return pair[1];
    }
    return "";
};
function view(el, model) {
    const user = getCookie("user");
    if (user !== "")
        model["username"] = user;
    model["home"] = el.getAttribute("data-home");
    model["anon"] = el.getAttribute("data-anon");
    model["profileid"] = el.getAttribute("data-profile");
    model["variant"] = el.getAttribute("data-variant");
    model["chess960"] = el.getAttribute("data-chess960");
    model["level"] = el.getAttribute("data-level");
    model["username"] = user !== "" ? user : el.getAttribute("data-user");
    model["gameId"] = el.getAttribute("data-gameid");
    model["wplayer"] = el.getAttribute("data-wplayer");
    model["wtitle"] = el.getAttribute("data-wtitle");
    model["bplayer"] = el.getAttribute("data-bplayer");
    model["btitle"] = el.getAttribute("data-btitle");
    model["fen"] = el.getAttribute("data-fen");
    model["base"] = el.getAttribute("data-base");
    model["inc"] = el.getAttribute("data-inc");
    model["result"] = el.getAttribute("data-result");
    model["status"] = el.getAttribute("data-status");
    model["date"] = el.getAttribute("data-date");
    model["tv"] = el.getAttribute("data-view") === 'tv';
    switch (el.getAttribute("data-view")) {
        case 'about':
            return h_1.default('div#placeholder.about-wrapper', about_1.aboutView(model));
        case 'players':
            return h_1.default('div#placeholder.players-wrapper', players_1.playersView(model));
        case 'profile':
            return h_1.default('div#placeholder.profile-wrapper', profile_1.profileView(model));
        case 'tv':
        case 'round':
            return h_1.default('div#placeholder.main-wrapper', round_1.roundView(model));
        default:
            return h_1.default('div#placeholder.main-wrapper', lobby_1.lobbyView(model));
    }
}
exports.view = view;
const el = document.getElementById('pychess-variants');
if (el instanceof Element) {
    patch(document.getElementById('placeholder'), view(el, model));
}

},{"./about":31,"./lobby":37,"./players":40,"./profile":42,"./round":45,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],39:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
const pocket_1 = require("./pocket");
const chess_1 = require("./chess");
function selectMove(ctrl, ply) {
    const active = document.querySelector('li.move.active');
    if (active)
        active.classList.remove('active');
    const elPly = document.querySelector(`li.move[ply="${ply}"]`);
    if (elPly)
        elPly.classList.add('active');
    ctrl.goPly(ply);
    scrollToPly(ctrl);
}
function scrollToPly(ctrl) {
    if (ctrl.steps.length < 9)
        return;
    const movesEl = document.getElementById('moves');
    let st = undefined;
    const plyEl = movesEl.querySelector('li.move.active');
    if (ctrl.ply == 0)
        st = 0;
    else if (ctrl.ply == ctrl.steps.length - 1)
        st = 99999;
    else {
        if (plyEl)
            st = plyEl.offsetTop - movesEl.offsetHeight + plyEl.offsetHeight;
    }
    console.log("scrollToPly", ctrl.ply, st);
    if (typeof st == 'number') {
        if (st == 0 || st == 99999)
            movesEl.scrollTop = st;
        else if (plyEl) {
            var isSmoothScrollSupported = 'scrollBehavior' in document.documentElement.style;
            if (isSmoothScrollSupported) {
                plyEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            else {
                plyEl.scrollIntoView(false);
            }
        }
    }
}
// flip
function toggleOrientation(ctrl) {
    ctrl.flip = !ctrl.flip;
    ctrl.chessground.toggleOrientation();
    // TODO: players, pockets, clocks, moretime button etc.
    return;
    if (ctrl.variant === "shogi") {
        const color = ctrl.chessground.state.orientation === "white" ? "white" : "black";
        ctrl.setPieces(color);
    }
    ;
    const name_tmp = ctrl.players[0];
    ctrl.players[0] = ctrl.players[1];
    ctrl.players[1] = name_tmp;
    console.log("FLIP");
    if (chess_1.needPockets(ctrl.variant)) {
        const tmp = ctrl.pockets[0];
        ctrl.pockets[0] = ctrl.pockets[1];
        ctrl.pockets[1] = tmp;
        ctrl.vpocket0 = patch(ctrl.vpocket0, pocket_1.pocketView(ctrl, ctrl.flip ? ctrl.mycolor : ctrl.oppcolor, "top"));
        ctrl.vpocket1 = patch(ctrl.vpocket1, pocket_1.pocketView(ctrl, ctrl.flip ? ctrl.oppcolor : ctrl.mycolor, "bottom"));
    }
}
function movelistView(ctrl) {
    var container = document.getElementById('move-controls');
    ctrl.moveControls = patch(container, h_1.default('div.btn-controls', [
        h_1.default('button#flip-board', { on: { click: () => toggleOrientation(ctrl) } }, [h_1.default('i', { props: { title: 'Flip board' }, class: { "icon": true, "icon-refresh": true } }),]),
        h_1.default('button#fastbackward', { on: { click: () => selectMove(ctrl, 0) } }, [h_1.default('i', { class: { "icon": true, "icon-fast-backward": true } }),]),
        h_1.default('button#stepbackward', { on: { click: () => selectMove(ctrl, Math.max(ctrl.ply - 1, 0)) } }, [h_1.default('i', { class: { "icon": true, "icon-step-backward": true } }),]),
        h_1.default('button#stepforward', { on: { click: () => selectMove(ctrl, Math.min(ctrl.ply + 1, ctrl.steps.length - 1)) } }, [h_1.default('i', { class: { "icon": true, "icon-step-forward": true } }),]),
        h_1.default('button#fastforward', { on: { click: () => selectMove(ctrl, ctrl.steps.length - 1) } }, [h_1.default('i', { class: { "icon": true, "icon-fast-forward": true } }),]),
    ]));
    return h_1.default('div#moves', [h_1.default('ol.movelist#movelist')]);
}
exports.movelistView = movelistView;
function updateMovelist(ctrl) {
    var container = document.getElementById('movelist');
    const ply = ctrl.steps.length - 1;
    const move = ctrl.steps[ply]['san'];
    const active = document.querySelector('li.move.active');
    if (active)
        active.classList.remove('active');
    const el = h_1.default('li.move', { class: { active: true }, attrs: { ply: ply }, on: { click: () => selectMove(ctrl, ply) } }, move);
    if (ply % 2 == 0) {
        patch(container, h_1.default('ol.movelist#movelist', [el]));
    }
    else {
        patch(container, h_1.default('ol.movelist#movelist', [h_1.default('li.move.counter', (ply + 1) / 2), el]));
    }
    scrollToPly(ctrl);
}
exports.updateMovelist = updateMovelist;

},{"./chess":33,"./pocket":41,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],40:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
const user_1 = require("./user");
function renderPlayers(model, players) {
    console.log("players", model, players);
    const header = h_1.default('thead', [h_1.default('tr', [h_1.default('th', 'Players'),])]);
    var rows = players.map((player) => h_1.default('tr', [
        h_1.default('td.player-data', [
            h_1.default('i-side.online', { class: { "icon": true, "icon-online": player["online"], "icon-offline": !player["online"] } }),
            h_1.default('player', [
                h_1.default('a.user-link', { attrs: { href: '/@/' + player["_id"] } }, [
                    h_1.default('player-title', " " + player["title"] + " "),
                    player["_id"],
                ]),
            ]),
        ])
    ]));
    return [header, h_1.default('tbody', rows)];
}
function playersView(model) {
    user_1.renderUsername(model["home"], model["username"]);
    var xmlhttp = new XMLHttpRequest();
    var url = model["home"] + "/api/players";
    xmlhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var myArr = JSON.parse(this.responseText);
            myFunction(myArr);
        }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
    function myFunction(arr) {
        const oldVNode = document.getElementById('players');
        console.log(arr);
        if (oldVNode instanceof Element) {
            patch(oldVNode, h_1.default('table#players', renderPlayers(model, arr)));
        }
    }
    console.log(model);
    return [h_1.default('aside.sidebar-first'),
        h_1.default('main.main', [h_1.default('table#players')]),
        h_1.default('aside.sidebar-second'),
    ];
}
exports.playersView = playersView;

},{"./user":47,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],41:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const drag_1 = require("chessgroundx/drag");
const chess_1 = require("./chess");
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const eventNames = ['mousedown', 'touchstart'];
function pocketView(ctrl, color, position) {
    const pocket = ctrl.pockets[position === 'top' ? 0 : 1];
    const pieceRoles = Object.keys(pocket);
    return snabbdom_1.h('div.pocket.' + position, {
        class: { usable: true },
        hook: {
            insert: vnode => {
                eventNames.forEach(name => {
                    vnode.elm.addEventListener(name, (e) => {
                        if (position === (ctrl.flip ? 'top' : 'bottom'))
                            drag(ctrl, e);
                    });
                });
            }
        }
    }, pieceRoles.map(role => {
        let nb = pocket[role] || 0;
        return snabbdom_1.h('piece.' + role + '.' + color, {
            attrs: {
                'data-role': role,
                'data-color': color,
                'data-nb': nb,
            }
        });
    }));
}
exports.pocketView = pocketView;
function drag(ctrl, e) {
    if (e.button !== undefined && e.button !== 0)
        return; // only touch or left click
    const el = e.target, role = el.getAttribute('data-role'), color = el.getAttribute('data-color'), number = el.getAttribute('data-nb');
    if (!role || !color || number === '0')
        return;
    if (ctrl.clickDrop !== undefined && role === ctrl.clickDrop.role) {
        ctrl.clickDrop = undefined;
        ctrl.chessground.selectSquare(null);
        return;
    }
    // Show possible drop dests on my turn only not to mess up predrop
    if (ctrl.turnColor === ctrl.mycolor) {
        const dropDests = { "a0": ctrl.dests[chess_1.roleToSan[role] + "@"] };
        ctrl.chessground.newPiece({ "role": role, "color": color }, "a0");
        ctrl.chessground.set({
            turnColor: color,
            movable: {
                dests: dropDests,
                showDests: true,
            },
        });
        ctrl.chessground.selectSquare("a0");
        ctrl.chessground.set({ lastMove: ctrl.lastmove });
    }
    e.stopPropagation();
    e.preventDefault();
    drag_1.dragNewPiece(ctrl.chessground.state, { color, role }, e);
}
exports.drag = drag;
function dropIsValid(dests, role, key) {
    // console.log("dropDests:", dests, role, key)
    const drops = dests[chess_1.roleToSan[role] + "@"];
    // console.log("drops:", drops)
    if (drops === undefined || drops === null)
        return false;
    return drops.indexOf(key) !== -1;
}
exports.dropIsValid = dropIsValid;
// TODO: afre 1 move made only 1 pocket update needed at once, no need to update both
function updatePockets(ctrl, vpocket0, vpocket1) {
    // update pockets from fen
    if (chess_1.needPockets(ctrl.variant)) {
        const parts = ctrl.fullfen.split(" ");
        const fen_placement = parts[0];
        var pockets = "";
        const bracketPos = fen_placement.indexOf("[");
        if (bracketPos !== -1) {
            pockets = fen_placement.slice(bracketPos);
        }
        const c = ctrl.mycolor[0];
        const o = ctrl.oppcolor[0];
        const roles = chess_1.pocketRoles(ctrl.variant);
        var po = {};
        var pc = {};
        roles.forEach(role => pc[role] = chess_1.lc(pockets, chess_1.roleToSan[role].toLowerCase(), c === (ctrl.variant === 'shogi' ? 'b' : 'w')));
        roles.forEach(role => po[role] = chess_1.lc(pockets, chess_1.roleToSan[role].toLowerCase(), o === (ctrl.variant === 'shogi' ? 'b' : 'w')));
        if (ctrl.flip) {
            ctrl.pockets = [pc, po];
        }
        else {
            ctrl.pockets = [po, pc];
        }
        console.log(o, c, po, pc);
        ctrl.vpocket0 = patch(vpocket0, pocketView(ctrl, ctrl.flip ? ctrl.mycolor : ctrl.oppcolor, "top"));
        ctrl.vpocket1 = patch(vpocket1, pocketView(ctrl, ctrl.flip ? ctrl.oppcolor : ctrl.mycolor, "bottom"));
    }
}
exports.updatePockets = updatePockets;

},{"./chess":33,"chessgroundx/drag":6,"snabbdom":26,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],42:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
const chessgroundx_1 = require("chessgroundx");
const user_1 = require("./user");
const chess_1 = require("./chess");
const clock_1 = require("./clock");
function result(status, result) {
    var text = '';
    console.log("result()", status, result);
    switch (status) {
        case -2:
        case -1:
            text = 'Playing right now';
            break;
        case 0:
            text = 'Game aborted';
            break;
        case 1:
            text = 'Checkmate';
            break;
        case 2:
            text = 'Resigned';
            break;
        case 3:
            text = 'Stalemate';
            break;
        case 4:
            text = 'Time out';
            break;
        case 5:
            text = 'Draw';
            break;
        case 6:
            text = 'Time out';
            break;
        case 7:
            text = 'Abandoned';
            break;
        default:
            text = '*';
            break;
    }
    return (status <= 0) ? text : text + ', ' + result;
}
exports.result = result;
function renderGames(model, games) {
    //                h('fn', player["first_name"]),
    //                h('ln', player["last_name"]),
    //                h('country', player["country"]),
    const header = h_1.default('thead', [h_1.default('tr', [h_1.default('th', model["profileid"]),])]);
    var rows = games.map((game) => h_1.default('tr', { on: { click: () => { window.location.assign(model["home"] + '/' + game["_id"]); } },
    }, [
        h_1.default('td.board', [
            h_1.default('selection.' + chess_1.VARIANTS[game["v"]].board + '.' + chess_1.VARIANTS[game["v"]].pieces, [
                h_1.default('div.cg-wrap.' + chess_1.VARIANTS[game["v"]].cg + '.mini', { hook: {
                        insert: (vnode) => {
                            chessgroundx_1.Chessground(vnode.elm, {
                                coordinates: false,
                                viewOnly: true,
                                fen: game["f"],
                                geometry: chess_1.VARIANTS[game["v"]].geom
                            });
                        }
                    } }),
            ]),
        ]),
        h_1.default('td.games-info', [
            h_1.default('div.info0', { attrs: { "data-icon": chess_1.VARIANTS[game["v"]].icon }, class: { "icon": true } }, [
                h_1.default('div', [
                    h_1.default('div.tc', game["b"] + "+" + game["i"] + " • Casual • " + game["v"]),
                    h_1.default('info-date', { attrs: { timestamp: game["d"] } }),
                ]),
            ]),
            h_1.default('div', [
                h_1.default('player', [
                    h_1.default('a.user-link', { attrs: { href: '/@/' + game["us"][0] } }, [
                        h_1.default('player-title', " " + game["wt"] + " "),
                        game["us"][0],
                    ]),
                ]),
                h_1.default('vs', '-'),
                h_1.default('player', [
                    h_1.default('a.user-link', { attrs: { href: '/@/' + game["us"][1] } }, [
                        h_1.default('player-title', " " + game["bt"] + " "),
                        game["us"][1],
                    ]),
                ]),
            ]),
            h_1.default('div.info-result', {
                class: {
                    "win": (game["r"] === '1-0' && game["us"][0] === model["profileid"]) || (game["r"] === '0-1' && game["us"][1] === model["profileid"]),
                    "lose": (game["r"] === '0-1' && game["us"][0] === model["profileid"]) || (game["r"] === '1-0' && game["us"][1] === model["profileid"]),
                }
            }, result(game["s"], game["r"])),
        ])
    ]));
    return [header, h_1.default('tbody', rows)];
}
function profileView(model) {
    user_1.renderUsername(model["home"], model["username"]);
    var xmlhttp = new XMLHttpRequest();
    var url = model["home"] + "/api/" + model["profileid"] + "/games";
    xmlhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var myArr = JSON.parse(this.responseText);
            myFunction(myArr);
        }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
    function myFunction(arr) {
        const oldVNode = document.getElementById('games');
        console.log(arr);
        if (oldVNode instanceof Element) {
            patch(oldVNode, h_1.default('table#games', renderGames(model, arr)));
        }
        clock_1.renderTimeago();
    }
    console.log(model);
    return [h_1.default('aside.sidebar-first'),
        h_1.default('main.main', [h_1.default('table#games')]),
        h_1.default('aside.sidebar-second'),
    ];
}
exports.profileView = profileView;

},{"./chess":33,"./clock":34,"./user":47,"chessgroundx":4,"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}],43:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const tovnode_1 = __importDefault(require("snabbdom/tovnode"));
const util_1 = require("chessgroundx/util");
const chess_1 = require("./chess");
const patch = snabbdom_1.init([class_1.default, attributes_1.default, eventlisteners_1.default]);
function default_1(ctrl) {
    let promoting = false;
    let roles = [];
    function start(orig, dest, meta) {
        const ground = ctrl.getGround();
        if (chess_1.isPromotion(ctrl.variant, ground.state.pieces[dest], orig, dest, meta)) {
            const color = ctrl.mycolor;
            const orientation = ground.state.orientation;
            const movingRole = ground.state.pieces[dest].role;
            roles = chess_1.promotionRoles(ctrl.variant, movingRole);
            switch (ctrl.variant) {
                case "shogi":
                    if (chess_1.mandatoryPromotion(movingRole, dest, color)) {
                        promote(ground, dest, 'p' + ground.state.pieces[dest].role);
                        ctrl.sendMove(orig, dest, '+');
                    }
                    else {
                        draw_promo(dest, color, orientation);
                        promoting = {
                            orig: orig,
                            dest: dest,
                            callback: ctrl.sendMove,
                        };
                    }
                    ;
                    break;
                case 'makruk':
                    promote(ground, dest, 'met');
                    ctrl.sendMove(orig, dest, 'm');
                    break;
                case 'sittuyin':
                    promote(ground, dest, 'ferz');
                    ctrl.sendMove(orig, dest, 'f');
                    break;
                default:
                    draw_promo(dest, color, orientation);
                    promoting = {
                        orig: orig,
                        dest: dest,
                        callback: ctrl.sendMove,
                    };
            }
            ;
            return true;
        }
        return false;
    }
    ;
    function promote(g, key, role) {
        var pieces = {};
        var piece = g.state.pieces[key];
        if (g.state.pieces[key].role === role) {
            return false;
        }
        else {
            pieces[key] = {
                color: piece.color,
                role: role,
                promoted: true
            };
            g.setPieces(pieces);
            return true;
        }
    }
    function draw_promo(dest, color, orientation) {
        var container = tovnode_1.default(document.querySelector('extension'));
        patch(container, renderPromotion(dest, color, orientation));
    }
    function draw_no_promo() {
        var container = document.getElementById('extension_choice');
        patch(container, snabbdom_1.h('extension'));
    }
    function finish(role) {
        if (promoting) {
            draw_no_promo();
            const promoted = promote(ctrl.getGround(), promoting.dest, role);
            const promo = ctrl.variant === "shogi" ? promoted ? "+" : "" : chess_1.roleToSan[role].toLowerCase();
            if (promoting.callback)
                promoting.callback(promoting.orig, promoting.dest, promo);
            promoting = false;
        }
    }
    ;
    function cancel() {
        console.log("CANCEL promotion");
        return;
    }
    function bind(eventName, f, redraw) {
        return {
            insert(vnode) {
                vnode.elm.addEventListener(eventName, e => {
                    const res = f(e);
                    if (redraw)
                        redraw();
                    return res;
                });
            }
        };
    }
    function renderPromotion(dest, color, orientation) {
        const dim = ctrl.getGround().state.dimensions;
        const firstRankIs0 = dim.height === 10;
        var left = (dim.width - util_1.key2pos(dest, firstRankIs0)[0]) * (100 / dim.width);
        if (orientation === "white")
            left = (100 / dim.width) * (dim.width - 1) - left;
        var vertical = color === orientation ? "top" : "bottom";
        return snabbdom_1.h("div#extension_choice." + vertical, {
            hook: {
                insert: vnode => {
                    const el = vnode.elm;
                    el.addEventListener("click", () => cancel());
                    el.addEventListener("contextmenu", e => {
                        e.preventDefault();
                        return false;
                    });
                }
            }
        }, roles.map((serverRole, i) => {
            var top = (color === orientation ? i : dim.height - 1 - i) * (100 / dim.height);
            return snabbdom_1.h("square", {
                attrs: { style: "top: " + top + "%;left: " + left + "%" },
                hook: bind("click", e => {
                    e.stopPropagation();
                    finish(serverRole);
                }, false)
            }, [snabbdom_1.h("piece." + serverRole + "." + color)]);
        }));
    }
    return {
        start,
    };
}
exports.default = default_1;

},{"./chess":33,"chessgroundx/util":17,"snabbdom":26,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/tovnode":28}],44:[function(require,module,exports){
"use strict";
// http://jsfiddle.net/MissoulaLorenzo/gfn6ob3j/
// https://github.com/ornicar/lila/blob/master/ui/common/src/resize.ts
Object.defineProperty(exports, "__esModule", { value: true });
//export default function resizeHandle(els: cg.Elements, pref: number, ply: number) {
function resizeHandle(els) {
    //  if (!pref) return;
    if (true)
        return;
    const el = document.createElement('cg-resize');
    els.container.appendChild(el);
    const mousemoveEvent = 'mousemove';
    const mouseupEvent = 'mouseup';
    el.addEventListener('mousedown', (start) => {
        start.preventDefault();
        const startPos = eventPosition(start);
        const initialZoom = 100; //parseInt(getComputedStyle(document.body).getPropertyValue('--zoom'));
        let zoom = initialZoom;
        /*
            const saveZoom = window.lichess.debounce(() => {
              $.ajax({ method: 'post', url: '/pref/zoom?v=' + (100 + zoom) });
            }, 700);
        */
        const setZoom = (zoom) => {
            const el = document.querySelector('.cg-wrap');
            if (el) {
                //            const baseWidth = dimensions[VARIANTS[this.variant].geom].width * (this.variant === "shogi" ? 52 : 64);
                //            const baseHeight = dimensions[VARIANTS[this.variant].geom].height * (this.variant === "shogi" ? 60 : 64);
                const baseWidth = parseInt(document.defaultView.getComputedStyle(el).width || '', 10);
                const baseHeight = parseInt(document.defaultView.getComputedStyle(el).height || '', 10);
                console.log(baseWidth, baseHeight, zoom);
                const pxw = `${zoom / 100 * baseWidth}px`;
                const pxh = `${zoom / 100 * baseHeight}px`;
                el.style.width = pxw;
                el.style.height = pxh;
                const ev = document.createEvent('Event');
                ev.initEvent('chessground.resize', false, false);
                document.body.dispatchEvent(ev);
            }
        };
        const resize = (move) => {
            const pos = eventPosition(move);
            const delta = pos[0] - startPos[0] + pos[1] - startPos[1];
            zoom = Math.round(Math.min(150, Math.max(0, initialZoom + delta / 10)));
            //      document.body.setAttribute('style', '--zoom:' + zoom);
            //      window.lichess.dispatchEvent(window, 'resize');
            setZoom(zoom);
            //      saveZoom();
        };
        document.body.classList.add('resizing');
        document.addEventListener(mousemoveEvent, resize);
        document.addEventListener(mouseupEvent, () => {
            document.removeEventListener(mousemoveEvent, resize);
            document.body.classList.remove('resizing');
        }, { once: true });
    });
    /*
      if (pref == 1) {
        const toggle = (ply: number) => el.classList.toggle('none', ply >= 2);
        toggle(ply);
        window.lichess.pubsub.on('ply', toggle);
      }
    
      addNag(el);
    */
}
exports.default = resizeHandle;
function eventPosition(e) {
    if (e.clientX || e.clientX === 0)
        return [e.clientX, e.clientY];
    if (e.touches && e.targetTouches[0])
        return [e.targetTouches[0].clientX, e.targetTouches[0].clientY];
    return undefined;
}
/*
function addNag(el: HTMLElement) {

  const storage = window.lichess.storage.makeBoolean('resize-nag');
  if (storage.get()) return;

  window.lichess.loadCssPath('nag-circle');
  el.title = 'Drag to resize';
  el.innerHTML = '<div class="nag-circle"></div>';
  el.addEventListener(window.lichess.mousedownEvent, () => {
    storage.set(true);
    el.innerHTML = '';
  }, { once: true });

  setTimeout(() => storage.set(true), 15000);
}
*/ 

},{}],45:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const ctrl_1 = __importDefault(require("./ctrl"));
const chess_1 = require("./chess");
const clock_1 = require("./clock");
function runGround(vnode, model) {
    const el = vnode.elm;
    const ctrl = new ctrl_1.default(el, model);
    const cg = ctrl.chessground;
    window['cg'] = cg;
}
function roundView(model) {
    console.log("roundView model=", model);
    var playerTop, playerBottom, titleTop, titleBottom, dataIcon;
    dataIcon = chess_1.VARIANTS[model["variant"]].icon;
    if (model["username"] !== model["wplayer"] && model["username"] !== model["bplayer"]) {
        // spectator game view
        playerTop = model["variant"] === 'shogi' ? model["wplayer"] : model["bplayer"];
        playerBottom = model["variant"] === 'shogi' ? model["bplayer"] : model["wplayer"];
        titleTop = model["variant"] === 'shogi' ? model["wtitle"] : model["btitle"];
        titleBottom = model["variant"] === 'shogi' ? model["btitle"] : model["wtitle"];
    }
    else {
        playerTop = model["username"] === model["wplayer"] ? model["bplayer"] : model["wplayer"];
        playerBottom = model["username"];
        titleTop = model["username"] === model["wplayer"] ? model["btitle"] : model["wtitle"];
        titleBottom = model["username"] === model["wplayer"] ? model["wtitle"] : model["btitle"];
    }
    //    if (model["level"] > 0) {
    //        if (titleTop === "BOT") playerTop += ' level ' + model['level'];
    //        if (titleBottom === "BOT") playerBottom += ' level ' + model['level'];
    //    };
    clock_1.renderTimeago();
    return [snabbdom_1.h('aside.sidebar-first', [
            snabbdom_1.h('div.game-info', [
                snabbdom_1.h('div.info0', { attrs: { "data-icon": dataIcon }, class: { "icon": true } }, [
                    //                        h('div.info1', {attrs: {"data-icon": (model["chess960"] === 'True') ? "V" : ""}, class: {"icon": true}}, [
                    snabbdom_1.h('div', [
                        snabbdom_1.h('div.tc', model["base"] + "+" + model["inc"] + " • Casual • " + model["variant"]),
                        Number(model["status"]) >= 0 ? snabbdom_1.h('info-date', { attrs: { timestamp: model["date"] } }, clock_1.timeago(model["date"])) : "Playing right now",
                    ]),
                ]),
                snabbdom_1.h('div.player-data', [
                    snabbdom_1.h('i-side.online', { class: { "icon": true, "icon-white": true } }),
                    snabbdom_1.h('player', [
                        snabbdom_1.h('a.user-link', { attrs: { href: '/@/' + model["wplayer"] } }, [
                            snabbdom_1.h('player-title', " " + model["wtitle"] + " "),
                            model["wplayer"] + " (1500?)",
                        ]),
                    ]),
                ]),
                snabbdom_1.h('div.player-data', [
                    snabbdom_1.h('i-side.online', { class: { "icon": true, "icon-black": true } }),
                    snabbdom_1.h('player', [
                        snabbdom_1.h('a.user-link', { attrs: { href: '/@/' + model["bplayer"] } }, [
                            snabbdom_1.h('player-title', " " + model["btitle"] + " "),
                            model["bplayer"] + " (1500?)",
                        ]),
                    ]),
                ]),
            ]),
            snabbdom_1.h('div.roundchat#roundchat'),
        ]),
        snabbdom_1.h('main.main', [
            snabbdom_1.h('selection.' + chess_1.VARIANTS[model["variant"]].board + '.' + chess_1.VARIANTS[model["variant"]].pieces, [
                snabbdom_1.h('div.cg-wrap.' + chess_1.VARIANTS[model["variant"]].cg, { hook: { insert: (vnode) => runGround(vnode, model) },
                }),
            ]),
        ]),
        snabbdom_1.h('aside.sidebar-second', [
            snabbdom_1.h('div#pocket-wrapper', [
                snabbdom_1.h('div.' + chess_1.VARIANTS[model["variant"]].pieces + '.' + model["variant"], [
                    snabbdom_1.h('div.cg-wrap.pocket', [
                        snabbdom_1.h('div#pocket0'),
                    ]),
                ]),
            ]),
            snabbdom_1.h('div#clock0'),
            snabbdom_1.h('div.round-data', [
                snabbdom_1.h('round-player', [
                    snabbdom_1.h('div.player-data', [
                        snabbdom_1.h('i-side.online#top-player', { class: { "icon": true, "icon-online": false, "icon-offline": true } }),
                        snabbdom_1.h('player', [
                            snabbdom_1.h('a.user-link', { attrs: { href: '/@/' + playerTop } }, [
                                snabbdom_1.h('player-title', " " + titleTop + " "),
                                playerTop,
                            ]),
                            snabbdom_1.h('rating', "1500?"),
                        ]),
                    ]),
                ]),
                snabbdom_1.h('div#move-controls'),
                snabbdom_1.h('div#movelist'),
                snabbdom_1.h('div#after-game'),
                snabbdom_1.h('div#game-controls'),
                snabbdom_1.h('round-player', [
                    snabbdom_1.h('div.player-data', [
                        snabbdom_1.h('i-side.online#bottom-player', { class: { "icon": true, "icon-online": false, "icon-offline": true } }),
                        snabbdom_1.h('player', [
                            snabbdom_1.h('a.user-link', { attrs: { href: '/@/' + playerBottom } }, [
                                snabbdom_1.h('player-title', " " + titleBottom + " "),
                                playerBottom,
                            ]),
                            snabbdom_1.h('rating', "1500?"),
                        ]),
                    ]),
                ]),
            ]),
            snabbdom_1.h('div#clock1'),
            snabbdom_1.h('div#pocket-wrapper', [
                snabbdom_1.h('div.' + chess_1.VARIANTS[model["variant"]].pieces + '.' + model["variant"], [
                    snabbdom_1.h('div.cg-wrap.pocket', [
                        snabbdom_1.h('div#pocket1'),
                    ]),
                ]),
            ]),
            snabbdom_1.h('div#flip'),
        ]),
        snabbdom_1.h('under-left', "Spectators"),
        snabbdom_1.h('under-board', [snabbdom_1.h('div.#under-board')]),
        snabbdom_1.h('under-right', [snabbdom_1.h('div#zoom')]),
    ];
}
exports.roundView = roundView;

},{"./chess":33,"./clock":34,"./ctrl":35,"snabbdom":26}],46:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class sounds {
    constructor() {
        this.buildManySounds = (file, qty) => {
            var soundArray = [];
            while (soundArray.length < qty) {
                var el = document.createElement("audio");
                if (el.canPlayType('audio/mpeg')) {
                    el.src = '/static/sound/' + file + '.mp3';
                }
                else {
                    el.src = '/static/sound/' + file + '.ogg';
                }
                el.setAttribute("preload", "none");
                el.style.display = "none";
                soundArray.push(el);
                document.body.appendChild(el);
            }
            return soundArray;
        };
        this.getSound = (type) => {
            let target = this.tracks[type];
            target.index = (target.index + 1) % target.pool.length;
            // console.log("SOUND:", type, target.index);
            return target.pool[target.index];
        };
        this.tracks = {
            GenericNotify: { name: 'GenericNotify', qty: 1, pool: [], index: 0 },
            Move: { name: 'Move', qty: 8, pool: [], index: 0 },
            Capture: { name: 'Capture', qty: 4, pool: [], index: 0 },
            Check: { name: 'Check', qty: 2, pool: [], index: 0 },
            Draw: { name: 'Draw', qty: 1, pool: [], index: 0 },
            Victory: { name: 'Victory', qty: 1, pool: [], index: 0 },
            Defeat: { name: 'Defeat', qty: 1, pool: [], index: 0 },
            ShogiMove: { name: 'komaoto5', qty: 8, pool: [], index: 0 },
        };
        Object.keys(this.tracks).forEach(key => {
            let type = this.tracks[key];
            type.pool = this.buildManySounds(type.name, type.qty);
        });
    }
    genericNotify() { this.getSound('GenericNotify').play(); }
    ;
    move() { this.getSound('Move').play(); }
    ;
    capture() { this.getSound('Capture').play(); }
    ;
    check() { this.getSound('Check').play(); }
    ;
    draw() { this.getSound('Draw').play(); }
    ;
    victory() { this.getSound('Victory').play(); }
    ;
    defeat() { this.getSound('Defeat').play(); }
    ;
    shogimove() { this.getSound('ShogiMove').play(); }
    ;
}
exports.sound = new (sounds);
function changeCSS(cssFile) {
    // css file index in template.html
    var cssLinkIndex = 1;
    if (cssFile.includes("xiangqi")) {
        cssLinkIndex = 3;
    }
    else if (cssFile.includes("shogi")) {
        cssLinkIndex = 2;
    }
    else if (cssFile.includes("capasei")) {
        cssLinkIndex = 4;
    }
    document.getElementsByTagName("link").item(cssLinkIndex).setAttribute("href", cssFile);
}
exports.changeCSS = changeCSS;

},{}],47:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const snabbdom_1 = require("snabbdom");
const class_1 = __importDefault(require("snabbdom/modules/class"));
const attributes_1 = __importDefault(require("snabbdom/modules/attributes"));
const props_1 = __importDefault(require("snabbdom/modules/props"));
const eventlisteners_1 = __importDefault(require("snabbdom/modules/eventlisteners"));
const patch = snabbdom_1.init([class_1.default, attributes_1.default, props_1.default, eventlisteners_1.default]);
const h_1 = __importDefault(require("snabbdom/h"));
// TODO: create logout button when logged in
/*
function login(home) {
    console.log("LOGIN WITH LICHESS");
    window.location.assign(home + '/login');
};
*/
function renderUsername(home, username) {
    console.log("renderUsername()", username, home);
    var oldVNode = document.getElementById('username');
    if (oldVNode instanceof Element) {
        oldVNode.innerHTML = '';
        patch(oldVNode, h_1.default('div#username', h_1.default('a.nav-link', { attrs: { href: '/@/' + username } }, username)));
    }
    ;
    /*
        // if username is not a logged in name login else logout button
        var oldVNode = document.getElementById('login');
        if (oldVNode instanceof Element) {
            oldVNode.innerHTML = '';
            patch(oldVNode as HTMLElement, h('button', { on: { click: () => login(home) }, props: {title: 'Login with Lichess'} }, [h('i', {class: {"icon": true, "icon-sign-in": true} } ), ]));
        };
    */
}
exports.renderUsername = renderUsername;

},{"snabbdom":26,"snabbdom/h":19,"snabbdom/modules/attributes":22,"snabbdom/modules/class":23,"snabbdom/modules/eventlisteners":24,"snabbdom/modules/props":25}]},{},[38])(38)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvY2hlc3Nncm91bmR4L3NyYy9hbmltLnRzIiwibm9kZV9tb2R1bGVzL2NoZXNzZ3JvdW5keC9zcmMvYXBpLnRzIiwibm9kZV9tb2R1bGVzL2NoZXNzZ3JvdW5keC9zcmMvYm9hcmQudHMiLCJub2RlX21vZHVsZXMvY2hlc3Nncm91bmR4L3NyYy9jaGVzc2dyb3VuZC50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL2NvbmZpZy50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL2RyYWcudHMiLCJub2RlX21vZHVsZXMvY2hlc3Nncm91bmR4L3NyYy9kcmF3LnRzIiwibm9kZV9tb2R1bGVzL2NoZXNzZ3JvdW5keC9zcmMvZHJvcC50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL2V2ZW50cy50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL2V4cGxvc2lvbi50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL2Zlbi50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL3ByZW1vdmUudHMiLCJub2RlX21vZHVsZXMvY2hlc3Nncm91bmR4L3NyYy9yZW5kZXIudHMiLCJub2RlX21vZHVsZXMvY2hlc3Nncm91bmR4L3NyYy9zdGF0ZS50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL3N2Zy50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL3R5cGVzLnRzIiwibm9kZV9tb2R1bGVzL2NoZXNzZ3JvdW5keC9zcmMvdXRpbC50cyIsIm5vZGVfbW9kdWxlcy9jaGVzc2dyb3VuZHgvc3JjL3dyYXAudHMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vaC5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9odG1sZG9tYXBpLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL2lzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL21vZHVsZXMvYXR0cmlidXRlcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL2NsYXNzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMuanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vbW9kdWxlcy9wcm9wcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9zbmFiYmRvbS5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS90aHVuay5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS90b3Zub2RlLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3Zub2RlLmpzIiwibm9kZV9tb2R1bGVzL3NvY2tldHRlL2Rpc3Qvc29ja2V0dGUuanMiLCJzcmMvYWJvdXQudHMiLCJzcmMvY2hhdC50cyIsInNyYy9jaGVzcy50cyIsInNyYy9jbG9jay50cyIsInNyYy9jdHJsLnRzIiwic3JjL2dhdGluZy50cyIsInNyYy9sb2JieS50cyIsInNyYy9tYWluLnRzIiwic3JjL21vdmVsaXN0LnRzIiwic3JjL3BsYXllcnMudHMiLCJzcmMvcG9ja2V0LnRzIiwic3JjL3Byb2ZpbGUudHMiLCJzcmMvcHJvbW90aW9uLnRzIiwic3JjL3Jlc2l6ZS50cyIsInNyYy9yb3VuZC50cyIsInNyYy9zb3VuZC50cyIsInNyYy91c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNDQSwrQkFBOEI7QUE0QjlCLFNBQWdCLElBQUksQ0FBSSxRQUFxQixFQUFFLEtBQVk7SUFDekQsT0FBTyxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUN0RixDQUFDO0FBRkQsb0JBRUM7QUFFRCxTQUFnQixNQUFNLENBQUksUUFBcUIsRUFBRSxLQUFZO0lBQzNE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LEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsT0FBTztDQUFFLENBQUM7QUFFcEcsTUFBTSxPQUFPLEdBQWtDO0lBQzNDLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxTQUFTO0NBQUUsQ0FBQztBQUczRixNQUFNLFFBQVEsR0FBRztJQUNiLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxHQUFHO0NBQUUsQ0FBQztBQUV6SyxNQUFNLFFBQVEsR0FBRztJQUNiLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLEdBQUc7SUFDN0YsS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJO0NBQUUsQ0FBQztBQUUxRixNQUFNLFNBQVMsR0FBRztJQUNkLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVB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R0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FDdEMsS0FBSyxLQUFLLE9BQU8sQ0FBQyxDQUFDO1FBQ2pCLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6RSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUMxRSxDQUNGLENBQUM7QUFDSixDQUFDO0FBR0QsU0FBUyxLQUFLLENBQUMsS0FBZTtJQUM1QixPQUFPLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hHLENBQUM7QUFHRCxTQUFTLE9BQU8sQ0FBQyxLQUFlO0lBQzlCLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRSxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDdkUsQ0FBQztBQUdELE1BQU0sS0FBSyxHQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDekMsT0FBTyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3hFLENBQUMsQ0FBQTtBQUdELE1BQU0sT0FBTyxHQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDM0MsT0FBTyxNQUFNLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzFFLENBQUMsQ0FBQTtBQUdELE1BQU0sS0FBSyxHQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDekMsT0FBTyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM5QyxDQUFDLENBQUE7QUFHRCxTQUFTLEtBQUssQ0FBQyxLQUFlO0lBQzVCLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQ3pCLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FDdEYsQ0FBQztBQUNOLENBQUM7QUFHRCxNQUFNLE9BQU8sR0FBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQzNDLE9BQU8sSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsS0FBSyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzdELENBQUMsQ0FBQTtBQUdELE1BQU0sT0FBTyxHQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDM0MsT0FBTyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxLQUFLLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDN0QsQ0FBQyxDQUFBO0FBR0QsTUFBTSxLQUFLLEdBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxF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QUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFFdEMsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3BDLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUVyQyxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFFdEMsTUFBTSxVQUFVLEdBQWEsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDOUYsTUFBTSxVQUFVLEdBQWEsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDOUYsTUFBTSxXQUFXLEdBQWEsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEcsTUFBTSxXQUFXLEdBQWEsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFD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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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TUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxQyxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzVDLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEtBQUssS0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0MsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsS0FBSyxLQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQyxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxLQUFLLEtBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9DLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEtBQUssS0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0MsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsS0FBSyxLQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQyxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxLQUFLLEtBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRS9DLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3BDLENBQUM7QUE3RkQsMEJBNkZDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0lBQ3hELElBQUksT0FBTyxLQUFLLFNBQVM7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUN4QyxNQUFNLEVBQUUsR0FBRyxhQUFhLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMs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QUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUE7UUFDMUQsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFBO0tBQzdEO1NBQU07UUFDSCxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUE7UUFDMUQsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFBO1FBQzFELEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQTtRQUMxRCxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUE7S0FDN0Q7SUFDRCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDMUIsQ0FBQztBQWJELDBCQWFDO0FBRVksUUFBQSxTQUFTLEdBQUc7SUFDckIsSUFBSSxFQUFFLEdBQUc7SUFDVCxNQUFNLEVBQUUsR0FBRztJQUNYLE1BQU0sRUFBRSxHQUFHO0lBQ1gsSUFBSSxFQUFFLEdBQUc7SUFDVCxLQUFLLEVBQUUsR0FBRztJQUNWLElBQUksRUFBRSxHQUFHO0lBQ1QsVUFBVSxFQUFFLEdBQUc7SUFDZixTQUFTLEVBQUUsR0FBRztJQUNkLFFBQVEsRUFBRSxHQUFHO0lBQ2IsSUFBSSxFQUFFLEdBQUc7SUFDVCxJQUFJLEVBQUUsR0FBRztJQUNULEdBQUcsRUFBRSxHQUFHO0lBQ1IsSUFBSSxFQUFFLEdBQUc7SUFDVCxNQUFNLEVBQUUsR0FBRztJQUNYLEtBQUssRUFBRSxHQUFHO0NBQ2IsQ0FBQztBQUVXLFFBQUEsU0FBUyxHQUFHO0lBQ3JCLENBQUMsRUFBRSxNQUFNO0lBQ1QsQ0FBQyxFQUFFLFFBQVE7SUFDWCxDQUFDLEVBQUUsUUFBUTtJQUNYLENBQUMsRUFBRSxNQUFNO0lBQ1QsQ0FBQyxFQUFFLE9BQU87SUFDVixDQUFDLEVBQUUsTUFBTTtJQUNULENBQUMsRUFBRSxZQUFZO0lBQ2YsQ0FBQyxFQUFFLFdBQVc7SUFDZCxDQUFDLEVBQUUsVUFBVTtJQUNiLENBQUMsRUFBRSxNQUFNO0lBQ1QsQ0FBQyxFQUFFLE1BQU07SUFDVCxDQUFDLEVBQUUsS0FBSztJQUNSLENBQUMsRUFBRSxNQUFNO0lBQ1QsQ0FBQyxFQUFFLFFBQVE7SUFDWCxDQUFDLEVBQUUsT0FBTztJQUNWLENBQUMsRUFBRSxNQUFNO0lBQ1QsQ0FBQyxFQUFFLFFBQVE7SUFDWCxDQUFDLEVBQUUsUUFBUTtJQUNYLENBQUMsRUFBRSxNQUFNO0lBQ1QsQ0FBQyxFQUFFLE9BQU87SUFDVixDQUFDLEVBQUUsTUFBTTtJQUNULENBQUMsRUFBRSxZQUFZO0lBQ2YsQ0FBQyxFQUFFLFdBQVc7SUFDZCxDQUFDLEVBQUUsVUFBVTtJQUNiLENBQUMsRUFBRSxNQUFNO0lBQ1QsQ0FBQyxFQUFFLE1BQU07SUFDVCxDQUFDLEVBQUUsS0FBSztJQUNSLENBQUMsRUFBRSxNQUFNO0lBQ1QsQ0FBQyxFQUFFLFFBQVE7SUFDWCxDQUFDLEVBQUUsT0FBTztDQUNiLENBQUM7QUFFRiw0Q0FBNEM7QUFDNUMsU0FBZ0IsRUFBRSxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsU0FBUztJQUNyQyxJQUFJLFdBQVcsR0FBRyxDQUFDLENBQUM7SUFDcEIsSUFBSSxTQUFTO1FBQUUsTUFBTSxHQUFHLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUM3QyxLQUFL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QUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2hHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzFGLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzVGLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUUsS0FBSyxDQUFDLE1BQU0s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RSxLQUFLLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBQyxFQUFFLENBQUM7Z0NBQ2hILFdBQUMsQ0FBQyxvQkFBb0IsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztnQ0FDckQsV0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBQyxFQUFFLENBQUM7Z0NBQ2hILFdBQUMsQ0FBQyxvQkFBb0IsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztnQ0FDckQsV0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBQyxFQUFFLENBQUM7Z0NBQ2hILFdBQUMsQ0FBQyxvQkFBb0IsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztnQ0FDckQsV0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMs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QUMsRUFBRSxJQUFJLEVBQUcsRUFBRSxFQUFFLEtBQUssRUFBRyxDQUFDLEVBQUM7WUFDcEQsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUcsQ0FBQyxFQUFFLElBQUksRUFBRyxFQUFFLEVBQUUsS0FBSyxFQUFHLENBQUMsRUFBQztZQUMxRCxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRyxDQUFDLEVBQUUsSUFBSSxFQUFHLEVBQUUsRUFBRSxLQUFLLEVBQUcsQ0FBQyxFQUFDO1lBQ3RELElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFHLENBQUMsRUFBRSxJQUFJLEVBQUcsRUFBRSxFQUFFLEtBQUssRUFBRyxDQUFDLEVBQUM7WUFDcEQsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUcsQ0FBQyxFQUFFLElBQUksRUFBRyxFQUFFLEVBQUUsS0FBSyxFQUFHLENBQUMsRUFBQztZQUMxRCxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRyxDQUFDLEVBQUUsSUFBSSxFQUFHLEVBQUUsRUFBRSxLQUFLLEVBQUcsQ0FBQyxFQUFDO1lBQ3hELFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFHLENBQUMsRUFBRSxJQUFJLEVBQUcsRUFBRSxFQUFFLEtBQUssRUFBRyxDQUFDLEVBQUM7U0FDaEUsQ0FBQTtRQUVELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNuQyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzVCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMxRCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUEwQkQsYUFBYSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQUEsQ0FBQztJQUMzRCxJQUFJLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFBQSxDQUFDO0lBQ3pDLE9BQU8sS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUFBLENBQUM7SUFDL0MsS0FBSyxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQUEsQ0FBQztJQUMzQyxJQUFJLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFBQSxDQUFDO0lBQ3pDLE9BQU8sS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUFBLENBQUM7SUFDL0MsTUFBTSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQUEsQ0FBQztJQUM3QyxTQUFTLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFBQSxDQUFDO0NBQ3REO0FBRVksUUFBQSxLQUFLLEdBQUcsSUFBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBRWpDLFNBQWdCLFNBQVMsQ0FBQyxPQUFPO0lBQzdCLGtDQUFrQztJQUNsQyxJQUFJLFlBQVksR0FBRyxDQUFDLENBQUM7SUFDckIsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQzdCLFlBQVksR0FBRyxDQUFDLENBQUM7S0FDcEI7U0FBTSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDbEMsWUFBWSxHQUFHLENBQUMsQ0FBQztLQUNwQjtTQUFNLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsRUFBRTtRQUNwQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO0tBQ3BCO0lBQ0QsUUFBUSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUUsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQzVGLENBQUM7QUFYRCw4QkFXQzs7Ozs7Ozs7QUNuRUQsdUNBQWdDO0FBQ2hDLG1FQUEyQztBQUMzQyw2RUFBcUQ7QUFDckQsbUVBQWdEO0FBQ2hELHFGQUF3RDtBQUV4RCxNQUFNLEtBQUssR0FBRyxlQUFJLENBQUMsQ0FBQyxlQUFLLEVBQUUsb0JBQVUsRUFBRSxlQUFVLEVBQUUsd0JBQVMsQ0FBQyxDQUFDLENBQUM7QUFFL0QsbURBQTJCO0FBRTNCLDRDQUE0QztBQUM1Qzs7Ozs7RUFLRTtBQUNGLFNBQWdCLGNBQWMsQ0FBQyxJQUFJLEVBQUUsUUFBUTtJQUN6QyxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNoRCxJQUFJLFFBQVEsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ25ELElBQUksUUFBUSxZQUFZLE9BQU8sRUFBRTtRQUM3QixRQUFRLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUN4QixLQUFLLENBQUMsUUFBdUIsRUFBRSxXQUFDLENBQUMsY0FBYyxFQUFFLFdBQUMsQ0FBQyxZQUFZLEVBQUUsRUFBQyxLQUFLLEVBQUUsRUFBQyxJQUFJLEVBQUUsS0FBSyxHQUFHLFFBQVEsRUFBQyxFQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ25IO0lBQUEsQ0FBQztJQUNOOzs7Ozs7O01BT0U7QUFDRixDQUFDO0FBZkQsd0NBZUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJpbXBvcnQgeyBTdGF0ZSB9IGZyb20gJy4vc3RhdGUnXG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCdcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXG5cbmV4cG9ydCB0eXBlIE11dGF0aW9uPEE+ID0gKHN0YXRlOiBTdGF0ZSkgPT4gQTtcblxuLy8gMCwxIGFuaW1hdGlvbiBnb2FsXG4vLyAyLDMgYW5pbWF0aW9uIGN1cnJlbnQgc3RhdHVzXG5leHBvcnQgdHlwZSBBbmltVmVjdG9yID0gY2cuTnVtYmVyUXVhZFxuXG5leHBvcnQgaW50ZXJmYWNlIEFuaW1WZWN0b3JzIHtcbiAgW2tleTogc3RyaW5nXTogQW5pbVZlY3RvclxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFuaW1GYWRpbmdzIHtcbiAgW2tleTogc3RyaW5nXTogY2cuUGllY2Vcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBbmltUGxhbiB7XG4gIGFuaW1zOiBBbmltVmVjdG9ycztcbiAgZmFkaW5nczogQW5pbUZhZGluZ3M7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQW5pbUN1cnJlbnQge1xuICBzdGFydDogRE9NSGlnaFJlc1RpbWVTdGFtcDtcbiAgZnJlcXVlbmN5OiBjZy5LSHo7XG4gIHBsYW46IEFuaW1QbGFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYW5pbTxBPihtdXRhdGlvbjogTXV0YXRpb248QT4sIHN0YXRlOiBTdGF0ZSk6IEEge1xuICByZXR1cm4gc3RhdGUuYW5pbWF0aW9uLmVuYWJsZWQgPyBhbmltYXRlKG11dGF0aW9uLCBzdGF0ZSkgOiByZW5kZXIobXV0YXRpb24sIHN0YXRlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlcjxBPihtdXRhdGlvbjogTXV0YXRpb248QT4sIHN0YXRlOiBTdGF0ZSk6IEEge1xuICBjb25zdCByZXN1bHQgPSBtdXRhdGlvbihzdGF0ZSk7XG4gIHN0YXRlLmRvbS5yZWRyYXcoKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuaW50ZXJmYWNlIEFuaW1QaWVjZSB7XG4gIGtleTogY2cuS2V5O1xuICBwb3M6IGNnLlBvcztcbiAgcGllY2U6IGNnLlBpZWNlO1xufVxuaW50ZXJmYWNlIEFuaW1QaWVjZXMge1xuICBba2V5OiBzdHJpbmddOiBBbmltUGllY2Vcbn1cblxuZnVuY3Rpb24gbWFrZVBpZWNlKGtleTogY2cuS2V5LCBwaWVjZTogY2cuUGllY2UsIGZpcnN0UmFua0lzMDogYm9vbGVhbik6IEFuaW1QaWVjZSB7XG4gIHJldHVybiB7XG4gICAga2V5OiBrZXksXG4gICAgcG9zOiB1dGlsLmtleTJwb3Moa2V5LCBmaXJzdFJhbmtJczApLFxuICAgIHBpZWNlOiBwaWVjZVxuICB9O1xufVxuXG5mdW5jdGlvbiBjbG9zZXIocGllY2U6IEFuaW1QaWVjZSwgcGllY2VzOiBBbmltUGllY2VbXSk6IEFuaW1QaWVjZSB7XG4gIHJldHVybiBwaWVjZXMuc29ydCgocDEsIHAyKSA9PiB7XG4gICAgcmV0dXJuIHV0aWwuZGlzdGFuY2VTcShwaWVjZS5wb3MsIHAxLnBvcykgLSB1dGlsLmRpc3RhbmNlU3EocGllY2UucG9zLCBwMi5wb3MpO1xuICB9KVswXTtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZVBsYW4ocHJldlBpZWNlczogY2cuUGllY2VzLCBjdXJyZW50OiBTdGF0ZSk6IEFuaW1QbGFuIHtcbiAgY29uc3QgZmlyc3RSYW5rSXMwID0gY3VycmVudC5kaW1lbnNpb25zLmhlaWdodCA9PT0gMTA7XG4gIGNvbnN0IGFuaW1zOiBBbmltVmVjdG9ycyA9IHt9LFxuICBhbmltZWRPcmlnczogY2cuS2V5W10gPSBbXSxcbiAgZmFkaW5nczogQW5pbUZhZGluZ3MgPSB7fSxcbiAgbWlzc2luZ3M6IEFuaW1QaWVjZVtdID0gW10sXG4gIG5ld3M6IEFuaW1QaWVjZVtdID0gW10sXG4gIHByZVBpZWNlczogQW5pbVBpZWNlcyA9IHt9O1xuICBsZXQgY3VyUDogY2cuUGllY2UgfCB1bmRlZmluZWQsIHByZVA6IEFuaW1QaWVjZSB8IHVuZGVmaW5lZCwgaTogYW55LCB2ZWN0b3I6IGNnLk51bWJlclBhaXI7XG4gIGZvciAoaSBpbiBwcmV2UGllY2VzKSB7XG4gICAgcHJlUGllY2VzW2ldID0gbWFrZVBpZWNlKGkgYXMgY2cuS2V5LCBwcmV2UGllY2VzW2ldISwgZmlyc3RSYW5rSXMwKTtcbiAgfVxuICBmb3IgKGNvbnN0IGtleSBvZiB1dGlsLmFsbEtleXNbY3VycmVudC5nZW9tZXRyeV0pIHtcbiAgICBjdXJQID0gY3VycmVudC5waWVjZXNba2V5XTtcbiAgICBwcmVQID0gcHJlUGllY2VzW2tleV07XG4gICAgaWYgKGN1clApIHtcbiAgICAgIGlmIChwcmVQKSB7XG4gICAgICAgIGlmICghdXRpbC5zYW1lUGllY2UoY3VyUCwgcHJlUC5waWVjZSkpIHtcbiAgICAgICAgICBtaXNzaW5ncy5wdXNoKHByZVApO1xuICAgICAgICAgIG5ld3MucHVzaChtYWtlUGllY2Uoa2V5LCBjdXJQLCBmaXJzdFJhbmtJczApKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIG5ld3MucHVzaChtYWtlUGllY2Uoa2V5LCBjdXJQLCBmaXJzdFJhbmtJczApKTtcbiAgICB9IGVsc2UgaWYgKHByZVApIG1pc3NpbmdzLnB1c2gocHJlUCk7XG4gIH1cbiAgbmV3cy5mb3JFYWNoKG5ld1AgPT4ge1xuICAgIHByZVAgPSBjbG9zZXIobmV3UCwgbWlzc2luZ3MuZmlsdGVyKHAgPT4gdXRpbC5zYW1lUGllY2UobmV3UC5waWVjZSwgcC5waWVjZSkpKTtcbiAgICBpZiAocHJlUCkge1xuICAgICAgdmVjdG9yID0gW3ByZVAucG9zWzBdIC0gbmV3UC5wb3NbMF0sIHByZVAucG9zWzFdIC0gbmV3UC5wb3NbMV1dO1xuICAgICAgYW5pbXNbbmV3UC5rZXldID0gdmVjdG9yLmNvbmNhdCh2ZWN0b3IpIGFzIEFuaW1WZWN0b3I7XG4gICAgICBhbmltZWRPcmlncy5wdXNoKHByZVAua2V5KTtcbiAgICB9XG4gIH0pO1xuICBtaXNzaW5ncy5mb3JFYWNoKHAgPT4ge1xuICAgIGlmICghdXRpbC5jb250YWluc1goYW5pbWVkT3JpZ3MsIHAua2V5KSkgZmFkaW5nc1twLmtleV0gPSBwLnBpZWNlO1xuICB9KTtcblxuICByZXR1cm4ge1xuICAgIGFuaW1zOiBhbmltcyxcbiAgICBmYWRpbmdzOiBmYWRpbmdzXG4gIH07XG59XG5cbmZ1bmN0aW9uIHN0ZXAoc3RhdGU6IFN0YXRlLCBub3c6IERPTUhpZ2hSZXNUaW1lU3RhbXApOiB2b2lkIHtcbiAgY29uc3QgY3VyID0gc3RhdGUuYW5pbWF0aW9uLmN1cnJlbnQ7XG4gIGlmIChjdXIgPT09IHVuZGVmaW5lZCkgeyAvLyBhbmltYXRpb24gd2FzIGNhbmNlbGVkIDooXG4gICAgaWYgKCFzdGF0ZS5kb20uZGVzdHJveWVkKSBzdGF0ZS5kb20ucmVkcmF3Tm93KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IHJlc3QgPSAxIC0gKG5vdyAtIGN1ci5zdGFydCkgKiBjdXIuZnJlcXVlbmN5O1xuICBpZiAocmVzdCA8PSAwKSB7XG4gICAgc3RhdGUuYW5pbWF0aW9uLmN1cnJlbnQgPSB1bmRlZmluZWQ7XG4gICAgc3RhdGUuZG9tLnJlZHJhd05vdygpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGVhc2UgPSBlYXNpbmcocmVzdCk7XG4gICAgZm9yIChsZXQgaSBpbiBjdXIucGxhbi5hbmltcykge1xuICAgICAgY29uc3QgY2ZnID0gY3VyLnBsYW4uYW5pbXNbaV07XG4gICAgICBjZmdbMl0gPSBjZmdbMF0gKiBlYXNlO1xuICAgICAgY2ZnWzNdID0gY2ZnWzFdICogZWFzZTtcbiAgICB9XG4gICAgc3RhdGUuZG9tLnJlZHJhd05vdyh0cnVlKTsgLy8gb3B0aW1pc2F0aW9uOiBkb24ndCByZW5kZXIgU1ZHIGNoYW5nZXMgZHVyaW5nIGFuaW1hdGlvbnNcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKG5vdyA9IHBlcmZvcm1hbmNlLm5vdygpKSA9PiBzdGVwKHN0YXRlLCBub3cpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhbmltYXRlPEE+KG11dGF0aW9uOiBNdXRhdGlvbjxBPiwgc3RhdGU6IFN0YXRlKTogQSB7XG4gIC8vIGNsb25lIHN0YXRlIGJlZm9yZSBtdXRhdGluZyBpdFxuICBjb25zdCBwcmV2UGllY2VzOiBjZy5QaWVjZXMgPSB7Li4uc3RhdGUucGllY2VzfTtcblxuICBjb25zdCByZXN1bHQgPSBtdXRhdGlvbihzdGF0ZSk7XG4gIGNvbnN0IHBsYW4gPSBjb21wdXRlUGxhbihwcmV2UGllY2VzLCBzdGF0ZSk7XG4gIGlmICghaXNPYmplY3RFbXB0eShwbGFuLmFuaW1zKSB8fCAhaXNPYmplY3RFbXB0eShwbGFuLmZhZGluZ3MpKSB7XG4gICAgY29uc3QgYWxyZWFkeVJ1bm5pbmcgPSBzdGF0ZS5hbmltYXRpb24uY3VycmVudCAmJiBzdGF0ZS5hbmltYXRpb24uY3VycmVudC5zdGFydDtcbiAgICBzdGF0ZS5hbmltYXRpb24uY3VycmVudCA9IHtcbiAgICAgIHN0YXJ0OiBwZXJmb3JtYW5jZS5ub3coKSxcbiAgICAgIGZyZXF1ZW5jeTogMSAvIHN0YXRlLmFuaW1hdGlvbi5kdXJhdGlvbixcbiAgICAgIHBsYW46IHBsYW5cbiAgICB9O1xuICAgIGlmICghYWxyZWFkeVJ1bm5pbmcpIHN0ZXAoc3RhdGUsIHBlcmZvcm1hbmNlLm5vdygpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBkb24ndCBhbmltYXRlLCBqdXN0IHJlbmRlciByaWdodCBhd2F5XG4gICAgc3RhdGUuZG9tLnJlZHJhdygpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0RW1wdHkobzogYW55KTogYm9vbGVhbiB7XG4gIGZvciAobGV0IF8gaW4gbykgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gdHJ1ZTtcbn1cbi8vIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL2dyZS8xNjUwMjk0XG5mdW5jdGlvbiBlYXNpbmcodDogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIHQgPCAwLjUgPyA0ICogdCAqIHQgKiB0IDogKHQgLSAxKSAqICgyICogdCAtIDIpICogKDIgKiB0IC0gMikgKyAxO1xufVxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xuaW1wb3J0ICogYXMgYm9hcmQgZnJvbSAnLi9ib2FyZCdcbmltcG9ydCB7IHdyaXRlIGFzIGZlbldyaXRlIH0gZnJvbSAnLi9mZW4nXG5pbXBvcnQgeyBDb25maWcsIGNvbmZpZ3VyZSB9IGZyb20gJy4vY29uZmlnJ1xuaW1wb3J0IHsgYW5pbSwgcmVuZGVyIH0gZnJvbSAnLi9hbmltJ1xuaW1wb3J0IHsgY2FuY2VsIGFzIGRyYWdDYW5jZWwsIGRyYWdOZXdQaWVjZSB9IGZyb20gJy4vZHJhZydcbmltcG9ydCB7IERyYXdTaGFwZSB9IGZyb20gJy4vZHJhdydcbmltcG9ydCBleHBsb3Npb24gZnJvbSAnLi9leHBsb3Npb24nXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xuXG5leHBvcnQgaW50ZXJmYWNlIEFwaSB7XG5cbiAgLy8gcmVjb25maWd1cmUgdGhlIGluc3RhbmNlLiBBY2NlcHRzIGFsbCBjb25maWcgb3B0aW9ucywgZXhjZXB0IGZvciB2aWV3T25seSAmIGRyYXdhYmxlLnZpc2libGUuXG4gIC8vIGJvYXJkIHdpbGwgYmUgYW5pbWF0ZWQgYWNjb3JkaW5nbHksIGlmIGFuaW1hdGlvbnMgYXJlIGVuYWJsZWQuXG4gIHNldChjb25maWc6IENvbmZpZyk6IHZvaWQ7XG5cbiAgLy8gcmVhZCBjaGVzc2dyb3VuZCBzdGF0ZTsgd3JpdGUgYXQgeW91ciBvd24gcmlza3MuXG4gIHN0YXRlOiBTdGF0ZTtcblxuICAvLyBnZXQgdGhlIHBvc2l0aW9uIGFzIGEgRkVOIHN0cmluZyAob25seSBjb250YWlucyBwaWVjZXMsIG5vIGZsYWdzKVxuICAvLyBlLmcuIHJuYnFrYm5yL3BwcHBwcHBwLzgvOC84LzgvUFBQUFBQUFAvUk5CUUtCTlJcbiAgZ2V0RmVuKCk6IGNnLkZFTjtcblxuICAvLyBjaGFuZ2UgdGhlIHZpZXcgYW5nbGVcbiAgdG9nZ2xlT3JpZW50YXRpb24oKTogdm9pZDtcblxuICAvLyBwZXJmb3JtIGEgbW92ZSBwcm9ncmFtbWF0aWNhbGx5XG4gIG1vdmUob3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXkpOiB2b2lkO1xuXG4gIC8vIGFkZCBhbmQvb3IgcmVtb3ZlIGFyYml0cmFyeSBwaWVjZXMgb24gdGhlIGJvYXJkXG4gIHNldFBpZWNlcyhwaWVjZXM6IGNnLlBpZWNlc0RpZmYpOiB2b2lkO1xuXG4gIC8vIGNsaWNrIGEgc3F1YXJlIHByb2dyYW1tYXRpY2FsbHlcbiAgc2VsZWN0U3F1YXJlKGtleTogY2cuS2V5IHwgbnVsbCwgZm9yY2U/OiBib29sZWFuKTogdm9pZDtcblxuICAvLyBwdXQgYSBuZXcgcGllY2Ugb24gdGhlIGJvYXJkXG4gIG5ld1BpZWNlKHBpZWNlOiBjZy5QaWVjZSwga2V5OiBjZy5LZXkpOiB2b2lkO1xuXG4gIC8vIHBsYXkgdGhlIGN1cnJlbnQgcHJlbW92ZSwgaWYgYW55OyByZXR1cm5zIHRydWUgaWYgcHJlbW92ZSB3YXMgcGxheWVkXG4gIHBsYXlQcmVtb3ZlKCk6IGJvb2xlYW47XG5cbiAgLy8gY2FuY2VsIHRoZSBjdXJyZW50IHByZW1vdmUsIGlmIGFueVxuICBjYW5jZWxQcmVtb3ZlKCk6IHZvaWQ7XG5cbiAgLy8gcGxheSB0aGUgY3VycmVudCBwcmVkcm9wLCBpZiBhbnk7IHJldHVybnMgdHJ1ZSBpZiBwcmVtb3ZlIHdhcyBwbGF5ZWRcbiAgcGxheVByZWRyb3AodmFsaWRhdGU6IChkcm9wOiBjZy5Ecm9wKSA9PiBib29sZWFuKTogYm9vbGVhbjtcblxuICAvLyBjYW5jZWwgdGhlIGN1cnJlbnQgcHJlZHJvcCwgaWYgYW55XG4gIGNhbmNlbFByZWRyb3AoKTogdm9pZDtcblxuICAvLyBjYW5jZWwgdGhlIGN1cnJlbnQgbW92ZSBiZWluZyBtYWRlXG4gIGNhbmNlbE1vdmUoKTogdm9pZDtcblxuICAvLyBjYW5jZWwgY3VycmVudCBtb3ZlIGFuZCBwcmV2ZW50IGZ1cnRoZXIgb25lc1xuICBzdG9wKCk6IHZvaWQ7XG5cbiAgLy8gbWFrZSBzcXVhcmVzIGV4cGxvZGUgKGF0b21pYyBjaGVzcylcbiAgZXhwbG9kZShrZXlzOiBjZy5LZXlbXSk6IHZvaWQ7XG5cbiAgLy8gcHJvZ3JhbW1hdGljYWxseSBkcmF3IHVzZXIgc2hhcGVzXG4gIHNldFNoYXBlcyhzaGFwZXM6IERyYXdTaGFwZVtdKTogdm9pZDtcblxuICAvLyBwcm9ncmFtbWF0aWNhbGx5IGRyYXcgYXV0byBzaGFwZXNcbiAgc2V0QXV0b1NoYXBlcyhzaGFwZXM6IERyYXdTaGFwZVtdKTogdm9pZDtcblxuICAvLyBzcXVhcmUgbmFtZSBhdCB0aGlzIERPTSBwb3NpdGlvbiAobGlrZSBcImU0XCIpXG4gIGdldEtleUF0RG9tUG9zKHBvczogY2cuTnVtYmVyUGFpcik6IGNnLktleSB8IHVuZGVmaW5lZDtcblxuICAvLyBvbmx5IHVzZWZ1bCB3aGVuIENTUyBjaGFuZ2VzIHRoZSBib2FyZCB3aWR0aC9oZWlnaHQgcmF0aW8gKGZvciAzRClcbiAgcmVkcmF3QWxsOiBjZy5SZWRyYXc7XG5cbiAgLy8gZm9yIGNyYXp5aG91c2UgYW5kIGJvYXJkIGVkaXRvcnNcbiAgZHJhZ05ld1BpZWNlKHBpZWNlOiBjZy5QaWVjZSwgZXZlbnQ6IGNnLk1vdWNoRXZlbnQsIGZvcmNlPzogYm9vbGVhbik6IHZvaWQ7XG5cbiAgLy8gdW5iaW5kcyBhbGwgZXZlbnRzXG4gIC8vIChpbXBvcnRhbnQgZm9yIGRvY3VtZW50LXdpZGUgZXZlbnRzIGxpa2Ugc2Nyb2xsIGFuZCBtb3VzZW1vdmUpXG4gIGRlc3Ryb3k6IGNnLlVuYmluZFxufVxuXG4vLyBzZWUgQVBJIHR5cGVzIGFuZCBkb2N1bWVudGF0aW9ucyBpbiBkdHMvYXBpLmQudHNcbmV4cG9ydCBmdW5jdGlvbiBzdGFydChzdGF0ZTogU3RhdGUsIHJlZHJhd0FsbDogY2cuUmVkcmF3KTogQXBpIHtcblxuICBmdW5jdGlvbiB0b2dnbGVPcmllbnRhdGlvbigpIHtcbiAgICBib2FyZC50b2dnbGVPcmllbnRhdGlvbihzdGF0ZSk7XG4gICAgcmVkcmF3QWxsKCk7XG4gIH07XG5cbiAgcmV0dXJuIHtcblxuICAgIHNldChjb25maWcpIHtcbiAgICAgIGlmIChjb25maWcub3JpZW50YXRpb24gJiYgY29uZmlnLm9yaWVudGF0aW9uICE9PSBzdGF0ZS5vcmllbnRhdGlvbikgdG9nZ2xlT3JpZW50YXRpb24oKTtcbiAgICAgIChjb25maWcuZmVuID8gYW5pbSA6IHJlbmRlcikoc3RhdGUgPT4gY29uZmlndXJlKHN0YXRlLCBjb25maWcpLCBzdGF0ZSk7XG4gICAgfSxcblxuICAgIHN0YXRlLFxuXG4gICAgZ2V0RmVuOiAoKSA9PiBmZW5Xcml0ZShzdGF0ZS5waWVjZXMsIHN0YXRlLmdlb21ldHJ5KSxcblxuICAgIHRvZ2dsZU9yaWVudGF0aW9uLFxuXG4gICAgc2V0UGllY2VzKHBpZWNlcykge1xuICAgICAgYW5pbShzdGF0ZSA9PiBib2FyZC5zZXRQaWVjZXMoc3RhdGUsIHBpZWNlcyksIHN0YXRlKTtcbiAgICB9LFxuXG4gICAgc2VsZWN0U3F1YXJlKGtleSwgZm9yY2UpIHtcbiAgICAgIGlmIChrZXkpIGFuaW0oc3RhdGUgPT4gYm9hcmQuc2VsZWN0U3F1YXJlKHN0YXRlLCBrZXksIGZvcmNlKSwgc3RhdGUpO1xuICAgICAgZWxzZSBpZiAoc3RhdGUuc2VsZWN0ZWQpIHtcbiAgICAgICAgYm9hcmQudW5zZWxlY3Qoc3RhdGUpO1xuICAgICAgICBzdGF0ZS5kb20ucmVkcmF3KCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIG1vdmUob3JpZywgZGVzdCkge1xuICAgICAgYW5pbShzdGF0ZSA9PiBib2FyZC5iYXNlTW92ZShzdGF0ZSwgb3JpZywgZGVzdCksIHN0YXRlKTtcbiAgICB9LFxuXG4gICAgbmV3UGllY2UocGllY2UsIGtleSkge1xuICAgICAgYW5pbShzdGF0ZSA9PiBib2FyZC5iYXNlTmV3UGllY2Uoc3RhdGUsIHBpZWNlLCBrZXkpLCBzdGF0ZSk7XG4gICAgfSxcblxuICAgIHBsYXlQcmVtb3ZlKCkge1xuICAgICAgaWYgKHN0YXRlLnByZW1vdmFibGUuY3VycmVudCkge1xuICAgICAgICBpZiAoYW5pbShib2FyZC5wbGF5UHJlbW92ZSwgc3RhdGUpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgLy8gaWYgdGhlIHByZW1vdmUgY291bGRuJ3QgYmUgcGxheWVkLCByZWRyYXcgdG8gY2xlYXIgaXQgdXBcbiAgICAgICAgc3RhdGUuZG9tLnJlZHJhdygpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cbiAgICBwbGF5UHJlZHJvcCh2YWxpZGF0ZSkge1xuICAgICAgaWYgKHN0YXRlLnByZWRyb3BwYWJsZS5jdXJyZW50KSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGJvYXJkLnBsYXlQcmVkcm9wKHN0YXRlLCB2YWxpZGF0ZSk7XG4gICAgICAgIHN0YXRlLmRvbS5yZWRyYXcoKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gICAgY2FuY2VsUHJlbW92ZSgpIHtcbiAgICAgIHJlbmRlcihib2FyZC51bnNldFByZW1vdmUsIHN0YXRlKTtcbiAgICB9LFxuXG4gICAgY2FuY2VsUHJlZHJvcCgpIHtcbiAgICAgIHJlbmRlcihib2FyZC51bnNldFByZWRyb3AsIHN0YXRlKTtcbiAgICB9LFxuXG4gICAgY2FuY2VsTW92ZSgpIHtcbiAgICAgIHJlbmRlcihzdGF0ZSA9PiB7IGJvYXJkLmNhbmNlbE1vdmUoc3RhdGUpOyBkcmFnQ2FuY2VsKHN0YXRlKTsgfSwgc3RhdGUpO1xuICAgIH0sXG5cbiAgICBzdG9wKCkge1xuICAgICAgcmVuZGVyKHN0YXRlID0+IHsgYm9hcmQuc3RvcChzdGF0ZSk7IGRyYWdDYW5jZWwoc3RhdGUpOyB9LCBzdGF0ZSk7XG4gICAgfSxcblxuICAgIGV4cGxvZGUoa2V5czogY2cuS2V5W10pIHtcbiAgICAgIGV4cGxvc2lvbihzdGF0ZSwga2V5cyk7XG4gICAgfSxcblxuICAgIHNldEF1dG9TaGFwZXMoc2hhcGVzOiBEcmF3U2hhcGVbXSkge1xuICAgICAgcmVuZGVyKHN0YXRlID0+IHN0YXRlLmRyYXdhYmxlLmF1dG9TaGFwZXMgPSBzaGFwZXMsIHN0YXRlKTtcbiAgICB9LFxuXG4gICAgc2V0U2hhcGVzKHNoYXBlczogRHJhd1NoYXBlW10pIHtcbiAgICAgIHJlbmRlcihzdGF0ZSA9PiBzdGF0ZS5kcmF3YWJsZS5zaGFwZXMgPSBzaGFwZXMsIHN0YXRlKTtcbiAgICB9LFxuXG4gICAgZ2V0S2V5QXREb21Qb3MocG9zKSB7XG4gICAgICByZXR1cm4gYm9hcmQuZ2V0S2V5QXREb21Qb3MocG9zLCBib2FyZC53aGl0ZVBvdihzdGF0ZSksIHN0YXRlLmRvbS5ib3VuZHMoKSwgc3RhdGUuZ2VvbWV0cnkpO1xuICAgIH0sXG5cbiAgICByZWRyYXdBbGwsXG5cbiAgICBkcmFnTmV3UGllY2UocGllY2UsIGV2ZW50LCBmb3JjZSkge1xuICAgICAgZHJhZ05ld1BpZWNlKHN0YXRlLCBwaWVjZSwgZXZlbnQsIGZvcmNlKVxuICAgIH0sXG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgYm9hcmQuc3RvcChzdGF0ZSk7XG4gICAgICBzdGF0ZS5kb20udW5iaW5kICYmIHN0YXRlLmRvbS51bmJpbmQoKTtcbiAgICAgIHN0YXRlLmRvbS5kZXN0cm95ZWQgPSB0cnVlO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcbmltcG9ydCB7IHBvczJrZXksIGtleTJwb3MsIG9wcG9zaXRlLCBjb250YWluc1ggfSBmcm9tICcuL3V0aWwnXG5pbXBvcnQgcHJlbW92ZSBmcm9tICcuL3ByZW1vdmUnXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xuXG5leHBvcnQgdHlwZSBDYWxsYmFjayA9ICguLi5hcmdzOiBhbnlbXSkgPT4gdm9pZDtcblxuZXhwb3J0IGZ1bmN0aW9uIGNhbGxVc2VyRnVuY3Rpb24oZjogQ2FsbGJhY2sgfCB1bmRlZmluZWQsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG4gIGlmIChmKSBzZXRUaW1lb3V0KCgpID0+IGYoLi4uYXJncyksIDEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlT3JpZW50YXRpb24oc3RhdGU6IFN0YXRlKTogdm9pZCB7XG4gIHN0YXRlLm9yaWVudGF0aW9uID0gb3Bwb3NpdGUoc3RhdGUub3JpZW50YXRpb24pO1xuICBzdGF0ZS5hbmltYXRpb24uY3VycmVudCA9XG4gIHN0YXRlLmRyYWdnYWJsZS5jdXJyZW50ID1cbiAgc3RhdGUuc2VsZWN0ZWQgPSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNldChzdGF0ZTogU3RhdGUpOiB2b2lkIHtcbiAgc3RhdGUubGFzdE1vdmUgPSB1bmRlZmluZWQ7XG4gIHVuc2VsZWN0KHN0YXRlKTtcbiAgdW5zZXRQcmVtb3ZlKHN0YXRlKTtcbiAgdW5zZXRQcmVkcm9wKHN0YXRlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFBpZWNlcyhzdGF0ZTogU3RhdGUsIHBpZWNlczogY2cuUGllY2VzRGlmZik6IHZvaWQge1xuICBmb3IgKGxldCBrZXkgaW4gcGllY2VzKSB7XG4gICAgY29uc3QgcGllY2UgPSBwaWVjZXNba2V5XTtcbiAgICBpZiAocGllY2UpIHN0YXRlLnBpZWNlc1trZXldID0gcGllY2U7XG4gICAgZWxzZSBkZWxldGUgc3RhdGUucGllY2VzW2tleV07XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldENoZWNrKHN0YXRlOiBTdGF0ZSwgY29sb3I6IGNnLkNvbG9yIHwgYm9vbGVhbik6IHZvaWQge1xuICBzdGF0ZS5jaGVjayA9IHVuZGVmaW5lZDtcbiAgaWYgKGNvbG9yID09PSB0cnVlKSBjb2xvciA9IHN0YXRlLnR1cm5Db2xvcjtcbiAgaWYgKGNvbG9yKSBmb3IgKGxldCBrIGluIHN0YXRlLnBpZWNlcykge1xuICAgIGlmIChzdGF0ZS5waWVjZXNba10hLnJvbGUgPT09ICdraW5nJyAmJiBzdGF0ZS5waWVjZXNba10hLmNvbG9yID09PSBjb2xvcikge1xuICAgICAgc3RhdGUuY2hlY2sgPSBrIGFzIGNnLktleTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0UHJlbW92ZShzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5LCBtZXRhOiBjZy5TZXRQcmVtb3ZlTWV0YWRhdGEpOiB2b2lkIHtcbiAgdW5zZXRQcmVkcm9wKHN0YXRlKTtcbiAgc3RhdGUucHJlbW92YWJsZS5jdXJyZW50ID0gW29yaWcsIGRlc3RdO1xuICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLnByZW1vdmFibGUuZXZlbnRzLnNldCwgb3JpZywgZGVzdCwgbWV0YSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bnNldFByZW1vdmUoc3RhdGU6IFN0YXRlKTogdm9pZCB7XG4gIGlmIChzdGF0ZS5wcmVtb3ZhYmxlLmN1cnJlbnQpIHtcbiAgICBzdGF0ZS5wcmVtb3ZhYmxlLmN1cnJlbnQgPSB1bmRlZmluZWQ7XG4gICAgY2FsbFVzZXJGdW5jdGlvbihzdGF0ZS5wcmVtb3ZhYmxlLmV2ZW50cy51bnNldCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0UHJlZHJvcChzdGF0ZTogU3RhdGUsIHJvbGU6IGNnLlJvbGUsIGtleTogY2cuS2V5KTogdm9pZCB7XG4gIHVuc2V0UHJlbW92ZShzdGF0ZSk7XG4gIHN0YXRlLnByZWRyb3BwYWJsZS5jdXJyZW50ID0geyByb2xlLCBrZXkgfTtcbiAgY2FsbFVzZXJGdW5jdGlvbihzdGF0ZS5wcmVkcm9wcGFibGUuZXZlbnRzLnNldCwgcm9sZSwga2V5KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVuc2V0UHJlZHJvcChzdGF0ZTogU3RhdGUpOiB2b2lkIHtcbiAgY29uc3QgcGQgPSBzdGF0ZS5wcmVkcm9wcGFibGU7XG4gIGlmIChwZC5jdXJyZW50KSB7XG4gICAgcGQuY3VycmVudCA9IHVuZGVmaW5lZDtcbiAgICBjYWxsVXNlckZ1bmN0aW9uKHBkLmV2ZW50cy51bnNldCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdHJ5QXV0b0Nhc3RsZShzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5KTogYm9vbGVhbiB7XG4gIGlmICghc3RhdGUuYXV0b0Nhc3RsZSkgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBraW5nID0gc3RhdGUucGllY2VzW29yaWddO1xuICBpZiAoIWtpbmcgfHwga2luZy5yb2xlICE9PSAna2luZycpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgZmlyc3RSYW5rSXMwID0gc3RhdGUuZGltZW5zaW9ucy5oZWlnaHQgPT09IDEwO1xuICBjb25zdCBvcmlnUG9zID0ga2V5MnBvcyhvcmlnLCBmaXJzdFJhbmtJczApO1xuICBpZiAob3JpZ1Bvc1swXSAhPT0gNSkgcmV0dXJuIGZhbHNlO1xuICBpZiAob3JpZ1Bvc1sxXSAhPT0gMSAmJiBvcmlnUG9zWzFdICE9PSA4KSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGRlc3RQb3MgPSBrZXkycG9zKGRlc3QsIGZpcnN0UmFua0lzMCk7XG4gIGxldCBvbGRSb29rUG9zLCBuZXdSb29rUG9zLCBuZXdLaW5nUG9zO1xuICBpZiAoZGVzdFBvc1swXSA9PT0gNyB8fCBkZXN0UG9zWzBdID09PSA4KSB7XG4gICAgb2xkUm9va1BvcyA9IHBvczJrZXkoWzgsIG9yaWdQb3NbMV1dLCBzdGF0ZS5nZW9tZXRyeSk7XG4gICAgbmV3Um9va1BvcyA9IHBvczJrZXkoWzYsIG9yaWdQb3NbMV1dLCBzdGF0ZS5nZW9tZXRyeSk7XG4gICAgbmV3S2luZ1BvcyA9IHBvczJrZXkoWzcsIG9yaWdQb3NbMV1dLCBzdGF0ZS5nZW9tZXRyeSk7XG4gIH0gZWxzZSBpZiAoZGVzdFBvc1swXSA9PT0gMyB8fCBkZXN0UG9zWzBdID09PSAxKSB7XG4gICAgb2xkUm9va1BvcyA9IHBvczJrZXkoWzEsIG9yaWdQb3NbMV1dLCBzdGF0ZS5nZW9tZXRyeSk7XG4gICAgbmV3Um9va1BvcyA9IHBvczJrZXkoWzQsIG9yaWdQb3NbMV1dLCBzdGF0ZS5nZW9tZXRyeSk7XG4gICAgbmV3S2luZ1BvcyA9IHBvczJrZXkoWzMsIG9yaWdQb3NbMV1dLCBzdGF0ZS5nZW9tZXRyeSk7XG4gIH0gZWxzZSByZXR1cm4gZmFsc2U7XG5cbiAgY29uc3Qgcm9vayA9IHN0YXRlLnBpZWNlc1tvbGRSb29rUG9zXTtcbiAgaWYgKCFyb29rIHx8IHJvb2sucm9sZSAhPT0gJ3Jvb2snKSByZXR1cm4gZmFsc2U7XG5cbiAgZGVsZXRlIHN0YXRlLnBpZWNlc1tvcmlnXTtcbiAgZGVsZXRlIHN0YXRlLnBpZWNlc1tvbGRSb29rUG9zXTtcblxuICBzdGF0ZS5waWVjZXNbbmV3S2luZ1Bvc10gPSBraW5nXG4gIHN0YXRlLnBpZWNlc1tuZXdSb29rUG9zXSA9IHJvb2s7XG4gIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYmFzZU1vdmUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSk6IGNnLlBpZWNlIHwgYm9vbGVhbiB7XG4gIGNvbnN0IG9yaWdQaWVjZSA9IHN0YXRlLnBpZWNlc1tvcmlnXSwgZGVzdFBpZWNlID0gc3RhdGUucGllY2VzW2Rlc3RdO1xuICBpZiAob3JpZyA9PT0gZGVzdCB8fCAhb3JpZ1BpZWNlKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGNhcHR1cmVkID0gKGRlc3RQaWVjZSAmJiBkZXN0UGllY2UuY29sb3IgIT09IG9yaWdQaWVjZS5jb2xvcikgPyBkZXN0UGllY2UgOiB1bmRlZmluZWQ7XG4gIGlmIChkZXN0ID09IHN0YXRlLnNlbGVjdGVkKSB1bnNlbGVjdChzdGF0ZSk7XG4gIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUuZXZlbnRzLm1vdmUsIG9yaWcsIGRlc3QsIGNhcHR1cmVkKTtcbiAgaWYgKCF0cnlBdXRvQ2FzdGxlKHN0YXRlLCBvcmlnLCBkZXN0KSkge1xuICAgIHN0YXRlLnBpZWNlc1tkZXN0XSA9IG9yaWdQaWVjZTtcbiAgICBkZWxldGUgc3RhdGUucGllY2VzW29yaWddO1xuICB9XG4gIHN0YXRlLmxhc3RNb3ZlID0gW29yaWcsIGRlc3RdO1xuICBzdGF0ZS5jaGVjayA9IHVuZGVmaW5lZDtcbiAgY2FsbFVzZXJGdW5jdGlvbihzdGF0ZS5ldmVudHMuY2hhbmdlKTtcbiAgcmV0dXJuIGNhcHR1cmVkIHx8IHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiYXNlTmV3UGllY2Uoc3RhdGU6IFN0YXRlLCBwaWVjZTogY2cuUGllY2UsIGtleTogY2cuS2V5LCBmb3JjZT86IGJvb2xlYW4pOiBib29sZWFuIHtcbiAgaWYgKHN0YXRlLnBpZWNlc1trZXldKSB7XG4gICAgaWYgKGZvcmNlKSBkZWxldGUgc3RhdGUucGllY2VzW2tleV07XG4gICAgZWxzZSByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY2FsbFVzZXJGdW5jdGlvbihzdGF0ZS5ldmVudHMuZHJvcE5ld1BpZWNlLCBwaWVjZSwga2V5KTtcbiAgc3RhdGUucGllY2VzW2tleV0gPSBwaWVjZTtcbiAgc3RhdGUubGFzdE1vdmUgPSBba2V5XTtcbiAgc3RhdGUuY2hlY2sgPSB1bmRlZmluZWQ7XG4gIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUuZXZlbnRzLmNoYW5nZSk7XG4gIHN0YXRlLm1vdmFibGUuZGVzdHMgPSB1bmRlZmluZWQ7XG4gIHN0YXRlLnR1cm5Db2xvciA9IG9wcG9zaXRlKHN0YXRlLnR1cm5Db2xvcik7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBiYXNlVXNlck1vdmUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSk6IGNnLlBpZWNlIHwgYm9vbGVhbiB7XG4gIGNvbnN0IHJlc3VsdCA9IGJhc2VNb3ZlKHN0YXRlLCBvcmlnLCBkZXN0KTtcbiAgaWYgKHJlc3VsdCkge1xuICAgIHN0YXRlLm1vdmFibGUuZGVzdHMgPSB1bmRlZmluZWQ7XG4gICAgc3RhdGUudHVybkNvbG9yID0gb3Bwb3NpdGUoc3RhdGUudHVybkNvbG9yKTtcbiAgICBzdGF0ZS5hbmltYXRpb24uY3VycmVudCA9IHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlck1vdmUoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSk6IGJvb2xlYW4ge1xuICBpZiAoY2FuTW92ZShzdGF0ZSwgb3JpZywgZGVzdCkpIHtcbiAgICBjb25zdCByZXN1bHQgPSBiYXNlVXNlck1vdmUoc3RhdGUsIG9yaWcsIGRlc3QpO1xuICAgIGlmIChyZXN1bHQpIHtcbiAgICAgIGNvbnN0IGhvbGRUaW1lID0gc3RhdGUuaG9sZC5zdG9wKCk7XG4gICAgICB1bnNlbGVjdChzdGF0ZSk7XG4gICAgICBjb25zdCBtZXRhZGF0YTogY2cuTW92ZU1ldGFkYXRhID0ge1xuICAgICAgICBwcmVtb3ZlOiBmYWxzZSxcbiAgICAgICAgY3RybEtleTogc3RhdGUuc3RhdHMuY3RybEtleSxcbiAgICAgICAgaG9sZFRpbWVcbiAgICAgIH07XG4gICAgICBpZiAocmVzdWx0ICE9PSB0cnVlKSBtZXRhZGF0YS5jYXB0dXJlZCA9IHJlc3VsdDtcbiAgICAgIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUubW92YWJsZS5ldmVudHMuYWZ0ZXIsIG9yaWcsIGRlc3QsIG1ldGFkYXRhKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfSBlbHNlIGlmIChjYW5QcmVtb3ZlKHN0YXRlLCBvcmlnLCBkZXN0KSkge1xuICAgIHNldFByZW1vdmUoc3RhdGUsIG9yaWcsIGRlc3QsIHtcbiAgICAgIGN0cmxLZXk6IHN0YXRlLnN0YXRzLmN0cmxLZXlcbiAgICB9KTtcbiAgICB1bnNlbGVjdChzdGF0ZSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdW5zZWxlY3Qoc3RhdGUpO1xuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkcm9wTmV3UGllY2Uoc3RhdGU6IFN0YXRlLCBvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSwgZm9yY2U/OiBib29sZWFuKTogdm9pZCB7XG4gIGlmIChjYW5Ecm9wKHN0YXRlLCBvcmlnLCBkZXN0KSB8fCBmb3JjZSkge1xuICAgIGNvbnN0IHBpZWNlID0gc3RhdGUucGllY2VzW29yaWddITtcbiAgICBkZWxldGUgc3RhdGUucGllY2VzW29yaWddO1xuICAgIGJhc2VOZXdQaWVjZShzdGF0ZSwgcGllY2UsIGRlc3QsIGZvcmNlKTtcbiAgICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLm1vdmFibGUuZXZlbnRzLmFmdGVyTmV3UGllY2UsIHBpZWNlLnJvbGUsIGRlc3QsIHtcbiAgICAgIHByZWRyb3A6IGZhbHNlXG4gICAgfSk7XG4gIH0gZWxzZSBpZiAoY2FuUHJlZHJvcChzdGF0ZSwgb3JpZywgZGVzdCkpIHtcbiAgICBzZXRQcmVkcm9wKHN0YXRlLCBzdGF0ZS5waWVjZXNbb3JpZ10hLnJvbGUsIGRlc3QpO1xuICB9IGVsc2Uge1xuICAgIHVuc2V0UHJlbW92ZShzdGF0ZSk7XG4gICAgdW5zZXRQcmVkcm9wKHN0YXRlKTtcbiAgfVxuICBkZWxldGUgc3RhdGUucGllY2VzW29yaWddO1xuICB1bnNlbGVjdChzdGF0ZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZWxlY3RTcXVhcmUoc3RhdGU6IFN0YXRlLCBrZXk6IGNnLktleSwgZm9yY2U/OiBib29sZWFuKTogdm9pZCB7XG4gIGNhbGxVc2VyRnVuY3Rpb24oc3RhdGUuZXZlbnRzLnNlbGVjdCwga2V5KTtcbiAgaWYgKHN0YXRlLnNlbGVjdGVkKSB7XG4gICAgaWYgKHN0YXRlLnNlbGVjdGVkID09PSBrZXkgJiYgIXN0YXRlLmRyYWdnYWJsZS5lbmFibGVkKSB7XG4gICAgICB1bnNlbGVjdChzdGF0ZSk7XG4gICAgICBzdGF0ZS5ob2xkLmNhbmNlbCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoKHN0YXRlLnNlbGVjdGFibGUuZW5hYmxlZCB8fCBmb3JjZSkgJiYgc3RhdGUuc2VsZWN0ZWQgIT09IGtleSkge1xuICAgICAgaWYgKHVzZXJNb3ZlKHN0YXRlLCBzdGF0ZS5zZWxlY3RlZCwga2V5KSkge1xuICAgICAgICBzdGF0ZS5zdGF0cy5kcmFnZ2VkID0gZmFsc2U7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKGlzTW92YWJsZShzdGF0ZSwga2V5KSB8fCBpc1ByZW1vdmFibGUoc3RhdGUsIGtleSkpIHtcbiAgICBzZXRTZWxlY3RlZChzdGF0ZSwga2V5KTtcbiAgICBzdGF0ZS5ob2xkLnN0YXJ0KCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFNlbGVjdGVkKHN0YXRlOiBTdGF0ZSwga2V5OiBjZy5LZXkpOiB2b2lkIHtcbiAgc3RhdGUuc2VsZWN0ZWQgPSBrZXk7XG4gIGlmIChpc1ByZW1vdmFibGUoc3RhdGUsIGtleSkpIHtcbiAgICBzdGF0ZS5wcmVtb3ZhYmxlLmRlc3RzID0gcHJlbW92ZShzdGF0ZS5waWVjZXMsIGtleSwgc3RhdGUucHJlbW92YWJsZS5jYXN0bGUsIHN0YXRlLmdlb21ldHJ5KTtcbiAgfVxuICBlbHNlIHN0YXRlLnByZW1vdmFibGUuZGVzdHMgPSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bnNlbGVjdChzdGF0ZTogU3RhdGUpOiB2b2lkIHtcbiAgc3RhdGUuc2VsZWN0ZWQgPSB1bmRlZmluZWQ7XG4gIHN0YXRlLnByZW1vdmFibGUuZGVzdHMgPSB1bmRlZmluZWQ7XG4gIHN0YXRlLmhvbGQuY2FuY2VsKCk7XG59XG5cbmZ1bmN0aW9uIGlzTW92YWJsZShzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSk6IGJvb2xlYW4ge1xuICBjb25zdCBwaWVjZSA9IHN0YXRlLnBpZWNlc1tvcmlnXTtcbiAgcmV0dXJuICEhcGllY2UgJiYgKFxuICAgIHN0YXRlLm1vdmFibGUuY29sb3IgPT09ICdib3RoJyB8fCAoXG4gICAgICBzdGF0ZS5tb3ZhYmxlLmNvbG9yID09PSBwaWVjZS5jb2xvciAmJlxuICAgICAgICBzdGF0ZS50dXJuQ29sb3IgPT09IHBpZWNlLmNvbG9yXG4gICAgKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYW5Nb3ZlKHN0YXRlOiBTdGF0ZSwgb3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXkpOiBib29sZWFuIHtcbiAgcmV0dXJuIG9yaWcgIT09IGRlc3QgJiYgaXNNb3ZhYmxlKHN0YXRlLCBvcmlnKSAmJiAoXG4gICAgc3RhdGUubW92YWJsZS5mcmVlIHx8ICghIXN0YXRlLm1vdmFibGUuZGVzdHMgJiYgY29udGFpbnNYKHN0YXRlLm1vdmFibGUuZGVzdHNbb3JpZ10sIGRlc3QpKVxuICApO1xufVxuXG5mdW5jdGlvbiBjYW5Ecm9wKHN0YXRlOiBTdGF0ZSwgb3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXkpOiBib29sZWFuIHtcbiAgY29uc3QgcGllY2UgPSBzdGF0ZS5waWVjZXNbb3JpZ107XG4gIHJldHVybiAhIXBpZWNlICYmIGRlc3QgJiYgKG9yaWcgPT09IGRlc3QgfHwgIXN0YXRlLnBpZWNlc1tkZXN0XSkgJiYgKFxuICAgIHN0YXRlLm1vdmFibGUuY29sb3IgPT09ICdib3RoJyB8fCAoXG4gICAgICBzdGF0ZS5tb3ZhYmxlLmNvbG9yID09PSBwaWVjZS5jb2xvciAmJlxuICAgICAgICBzdGF0ZS50dXJuQ29sb3IgPT09IHBpZWNlLmNvbG9yXG4gICAgKSk7XG59XG5cblxuZnVuY3Rpb24gaXNQcmVtb3ZhYmxlKHN0YXRlOiBTdGF0ZSwgb3JpZzogY2cuS2V5KTogYm9vbGVhbiB7XG4gIGNvbnN0IHBpZWNlID0gc3RhdGUucGllY2VzW29yaWddO1xuICByZXR1cm4gISFwaWVjZSAmJiBzdGF0ZS5wcmVtb3ZhYmxlLmVuYWJsZWQgJiZcbiAgc3RhdGUubW92YWJsZS5jb2xvciA9PT0gcGllY2UuY29sb3IgJiZcbiAgICBzdGF0ZS50dXJuQ29sb3IgIT09IHBpZWNlLmNvbG9yO1xufVxuXG5mdW5jdGlvbiBjYW5QcmVtb3ZlKHN0YXRlOiBTdGF0ZSwgb3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXkpOiBib29sZWFuIHtcbiAgcmV0dXJuIG9yaWcgIT09IGRlc3QgJiZcbiAgaXNQcmVtb3ZhYmxlKHN0YXRlLCBvcmlnKSAmJlxuICBjb250YWluc1gocHJlbW92ZShzdGF0ZS5waWVjZXMsIG9yaWcsIHN0YXRlLnByZW1vdmFibGUuY2FzdGxlLCBzdGF0ZS5nZW9tZXRyeSksIGRlc3QpO1xufVxuXG5mdW5jdGlvbiBjYW5QcmVkcm9wKHN0YXRlOiBTdGF0ZSwgb3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXkpOiBib29sZWFuIHtcbiAgY29uc3QgcGllY2UgPSBzdGF0ZS5waWVjZXNbb3JpZ107XG4gIGNvbnN0IGRlc3RQaWVjZSA9IHN0YXRlLnBpZWNlc1tkZXN0XTtcbiAgcmV0dXJuICEhcGllY2UgJiYgZGVzdCAmJlxuICAoIWRlc3RQaWVjZSB8fCBkZXN0UGllY2UuY29sb3IgIT09IHN0YXRlLm1vdmFibGUuY29sb3IpICYmXG4gIHN0YXRlLnByZWRyb3BwYWJsZS5lbmFibGVkICYmXG4gIChwaWVjZS5yb2xlICE9PSAncGF3bicgfHwgKGRlc3RbMV0gIT09ICcxJyAmJiBkZXN0WzFdICE9PSAnOCcpKSAmJlxuICBzdGF0ZS5tb3ZhYmxlLmNvbG9yID09PSBwaWVjZS5jb2xvciAmJlxuICAgIHN0YXRlLnR1cm5Db2xvciAhPT0gcGllY2UuY29sb3I7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RyYWdnYWJsZShzdGF0ZTogU3RhdGUsIG9yaWc6IGNnLktleSk6IGJvb2xlYW4ge1xuICBjb25zdCBwaWVjZSA9IHN0YXRlLnBpZWNlc1tvcmlnXTtcbiAgcmV0dXJuICEhcGllY2UgJiYgc3RhdGUuZHJhZ2dhYmxlLmVuYWJsZWQgJiYgKFxuICAgIHN0YXRlLm1vdmFibGUuY29sb3IgPT09ICdib3RoJyB8fCAoXG4gICAgICBzdGF0ZS5tb3ZhYmxlLmNvbG9yID09PSBwaWVjZS5jb2xvciAmJiAoXG4gICAgICAgIHN0YXRlLnR1cm5Db2xvciA9PT0gcGllY2UuY29sb3IgfHwgc3RhdGUucHJlbW92YWJsZS5lbmFibGVkXG4gICAgICApXG4gICAgKVxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGxheVByZW1vdmUoc3RhdGU6IFN0YXRlKTogYm9vbGVhbiB7XG4gIGNvbnN0IG1vdmUgPSBzdGF0ZS5wcmVtb3ZhYmxlLmN1cnJlbnQ7XG4gIGlmICghbW92ZSkgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBvcmlnID0gbW92ZVswXSwgZGVzdCA9IG1vdmVbMV07XG4gIGxldCBzdWNjZXNzID0gZmFsc2U7XG4gIGlmIChjYW5Nb3ZlKHN0YXRlLCBvcmlnLCBkZXN0KSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGJhc2VVc2VyTW92ZShzdGF0ZSwgb3JpZywgZGVzdCk7XG4gICAgaWYgKHJlc3VsdCkge1xuICAgICAgY29uc3QgbWV0YWRhdGE6IGNnLk1vdmVNZXRhZGF0YSA9IHsgcHJlbW92ZTogdHJ1ZSB9O1xuICAgICAgaWYgKHJlc3VsdCAhPT0gdHJ1ZSkgbWV0YWRhdGEuY2FwdHVyZWQgPSByZXN1bHQ7XG4gICAgICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLm1vdmFibGUuZXZlbnRzLmFmdGVyLCBvcmlnLCBkZXN0LCBtZXRhZGF0YSk7XG4gICAgICBzdWNjZXNzID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgdW5zZXRQcmVtb3ZlKHN0YXRlKTtcbiAgcmV0dXJuIHN1Y2Nlc3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwbGF5UHJlZHJvcChzdGF0ZTogU3RhdGUsIHZhbGlkYXRlOiAoZHJvcDogY2cuRHJvcCkgPT4gYm9vbGVhbik6IGJvb2xlYW4ge1xuICBsZXQgZHJvcCA9IHN0YXRlLnByZWRyb3BwYWJsZS5jdXJyZW50LFxuICBzdWNjZXNzID0gZmFsc2U7XG4gIGlmICghZHJvcCkgcmV0dXJuIGZhbHNlO1xuICBpZiAodmFsaWRhdGUoZHJvcCkpIHtcbiAgICBjb25zdCBwaWVjZSA9IHtcbiAgICAgIHJvbGU6IGRyb3Aucm9sZSxcbiAgICAgIGNvbG9yOiBzdGF0ZS5tb3ZhYmxlLmNvbG9yXG4gICAgfSBhcyBjZy5QaWVjZTtcbiAgICBpZiAoYmFzZU5ld1BpZWNlKHN0YXRlLCBwaWVjZSwgZHJvcC5rZXkpKSB7XG4gICAgICBjYWxsVXNlckZ1bmN0aW9uKHN0YXRlLm1vdmFibGUuZXZlbnRzLmFmdGVyTmV3UGllY2UsIGRyb3Aucm9sZSwgZHJvcC5rZXksIHtcbiAgICAgICAgcHJlZHJvcDogdHJ1ZVxuICAgICAgfSk7XG4gICAgICBzdWNjZXNzID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgdW5zZXRQcmVkcm9wKHN0YXRlKTtcbiAgcmV0dXJuIHN1Y2Nlc3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYW5jZWxNb3ZlKHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xuICB1bnNldFByZW1vdmUoc3RhdGUpO1xuICB1bnNldFByZWRyb3Aoc3RhdGUpO1xuICB1bnNlbGVjdChzdGF0ZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdG9wKHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xuICBzdGF0ZS5tb3ZhYmxlLmNvbG9yID1cbiAgc3RhdGUubW92YWJsZS5kZXN0cyA9XG4gIHN0YXRlLmFuaW1hdGlvbi5jdXJyZW50ID0gdW5kZWZpbmVkO1xuICBjYW5jZWxNb3ZlKHN0YXRlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEtleUF0RG9tUG9zKHBvczogY2cuTnVtYmVyUGFpciwgYXNXaGl0ZTogYm9vbGVhbiwgYm91bmRzOiBDbGllbnRSZWN0LCBnZW9tOiBjZy5HZW9tZXRyeSk6IGNnLktleSB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IGJkID0gY2cuZGltZW5zaW9uc1tnZW9tXTtcbiAgbGV0IGZpbGUgPSBNYXRoLmNlaWwoYmQud2lkdGggKiAoKHBvc1swXSAtIGJvdW5kcy5sZWZ0KSAvIGJvdW5kcy53aWR0aCkpO1xuICBpZiAoIWFzV2hpdGUpIGZpbGUgPSBiZC53aWR0aCArIDEgLSBmaWxlO1xuICBsZXQgcmFuayA9IE1hdGguY2VpbChiZC5oZWlnaHQgLSAoYmQuaGVpZ2h0ICogKChwb3NbMV0gLSBib3VuZHMudG9wKSAvIGJvdW5kcy5oZWlnaHQpKSk7XG4gIGlmICghYXNXaGl0ZSkgcmFuayA9IGJkLmhlaWdodCArIDEgLSByYW5rO1xuICByZXR1cm4gKGZpbGUgPiAwICYmIGZpbGUgPCBiZC53aWR0aCArIDEgJiYgcmFuayA+IDAgJiYgcmFuayA8IGJkLmhlaWdodCArIDEpID8gcG9zMmtleShbZmlsZSwgcmFua10sIGdlb20pIDogdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd2hpdGVQb3YoczogU3RhdGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIHMub3JpZW50YXRpb24gPT09ICd3aGl0ZSc7XG59XG4iLCJpbXBvcnQgeyBBcGksIHN0YXJ0IH0gZnJvbSAnLi9hcGknXG5pbXBvcnQgeyBDb25maWcsIGNvbmZpZ3VyZSB9IGZyb20gJy4vY29uZmlnJ1xuaW1wb3J0IHsgU3RhdGUsIGRlZmF1bHRzIH0gZnJvbSAnLi9zdGF0ZSdcblxuaW1wb3J0IHJlbmRlcldyYXAgZnJvbSAnLi93cmFwJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICcuL2V2ZW50cydcbmltcG9ydCByZW5kZXIgZnJvbSAnLi9yZW5kZXInO1xuaW1wb3J0ICogYXMgc3ZnIGZyb20gJy4vc3ZnJztcbmltcG9ydCAqIGFzIHV0aWwgZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGZ1bmN0aW9uIENoZXNzZ3JvdW5kKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjb25maWc/OiBDb25maWcpOiBBcGkge1xuXG4gIGNvbnN0IHN0YXRlID0gZGVmYXVsdHMoKSBhcyBTdGF0ZTtcblxuICBjb25maWd1cmUoc3RhdGUsIGNvbmZpZyB8fCB7fSk7XG5cbiAgZnVuY3Rpb24gcmVkcmF3QWxsKCkge1xuICAgIGxldCBwcmV2VW5iaW5kID0gc3RhdGUuZG9tICYmIHN0YXRlLmRvbS51bmJpbmQ7XG4gICAgLy8gY29tcHV0ZSBib3VuZHMgZnJvbSBleGlzdGluZyBib2FyZCBlbGVtZW50IGlmIHBvc3NpYmxlXG4gICAgLy8gdGhpcyBhbGxvd3Mgbm9uLXNxdWFyZSBib2FyZHMgZnJvbSBDU1MgdG8gYmUgaGFuZGxlZCAoZm9yIDNEKVxuICAgIGNvbnN0IHJlbGF0aXZlID0gc3RhdGUudmlld09ubHkgJiYgIXN0YXRlLmRyYXdhYmxlLnZpc2libGUsXG4gICAgZWxlbWVudHMgPSByZW5kZXJXcmFwKGVsZW1lbnQsIHN0YXRlLCByZWxhdGl2ZSksXG4gICAgYm91bmRzID0gdXRpbC5tZW1vKCgpID0+IGVsZW1lbnRzLmJvYXJkLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpKSxcbiAgICByZWRyYXdOb3cgPSAoc2tpcFN2Zz86IGJvb2xlYW4pID0+IHtcbiAgICAgIHJlbmRlcihzdGF0ZSk7XG4gICAgICBpZiAoIXNraXBTdmcgJiYgZWxlbWVudHMuc3ZnKSBzdmcucmVuZGVyU3ZnKHN0YXRlLCBlbGVtZW50cy5zdmcpO1xuICAgIH07XG4gICAgc3RhdGUuZG9tID0ge1xuICAgICAgZWxlbWVudHMsXG4gICAgICBib3VuZHMsXG4gICAgICByZWRyYXc6IGRlYm91bmNlUmVkcmF3KHJlZHJhd05vdyksXG4gICAgICByZWRyYXdOb3csXG4gICAgICB1bmJpbmQ6IHByZXZVbmJpbmQsXG4gICAgICByZWxhdGl2ZVxuICAgIH07XG4gICAgc3RhdGUuZHJhd2FibGUucHJldlN2Z0hhc2ggPSAnJztcbiAgICByZWRyYXdOb3coZmFsc2UpO1xuICAgIGV2ZW50cy5iaW5kQm9hcmQoc3RhdGUpO1xuICAgIGlmICghcHJldlVuYmluZCkgc3RhdGUuZG9tLnVuYmluZCA9IGV2ZW50cy5iaW5kRG9jdW1lbnQoc3RhdGUsIHJlZHJhd0FsbCk7XG4gICAgc3RhdGUuZXZlbnRzLmluc2VydCAmJiBzdGF0ZS5ldmVudHMuaW5zZXJ0KGVsZW1lbnRzKTtcbiAgfVxuICByZWRyYXdBbGwoKTtcblxuICByZXR1cm4gc3RhcnQoc3RhdGUsIHJlZHJhd0FsbCk7XG59O1xuXG5mdW5jdGlvbiBkZWJvdW5jZVJlZHJhdyhyZWRyYXdOb3c6IChza2lwU3ZnPzogYm9vbGVhbikgPT4gdm9pZCk6ICgpID0+IHZvaWQge1xuICBsZXQgcmVkcmF3aW5nID0gZmFsc2U7XG4gIHJldHVybiAoKSA9PiB7XG4gICAgaWYgKHJlZHJhd2luZykgcmV0dXJuO1xuICAgIHJlZHJhd2luZyA9IHRydWU7XG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgIHJlZHJhd05vdygpO1xuICAgICAgcmVkcmF3aW5nID0gZmFsc2U7XG4gICAgfSk7XG4gIH07XG59XG4iLCJpbXBvcnQgeyBTdGF0ZSB9IGZyb20gJy4vc3RhdGUnXG5pbXBvcnQgeyBzZXRDaGVjaywgc2V0U2VsZWN0ZWQgfSBmcm9tICcuL2JvYXJkJ1xuaW1wb3J0IHsgcmVhZCBhcyBmZW5SZWFkIH0gZnJvbSAnLi9mZW4nXG5pbXBvcnQgeyBEcmF3U2hhcGUsIERyYXdCcnVzaCB9IGZyb20gJy4vZHJhdydcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29uZmlnIHtcbiAgZmVuPzogY2cuRkVOOyAvLyBjaGVzcyBwb3NpdGlvbiBpbiBGb3JzeXRoIG5vdGF0aW9uXG4gIG9yaWVudGF0aW9uPzogY2cuQ29sb3I7IC8vIGJvYXJkIG9yaWVudGF0aW9uLiB3aGl0ZSB8IGJsYWNrXG4gIHR1cm5Db2xvcj86IGNnLkNvbG9yOyAvLyB0dXJuIHRvIHBsYXkuIHdoaXRlIHwgYmxhY2tcbiAgY2hlY2s/OiBjZy5Db2xvciB8IGJvb2xlYW47IC8vIHRydWUgZm9yIGN1cnJlbnQgY29sb3IsIGZhbHNlIHRvIHVuc2V0XG4gIGxhc3RNb3ZlPzogY2cuS2V5W107IC8vIHNxdWFyZXMgcGFydCBvZiB0aGUgbGFzdCBtb3ZlIFtcImMzXCIsIFwiYzRcIl1cbiAgc2VsZWN0ZWQ/OiBjZy5LZXk7IC8vIHNxdWFyZSBjdXJyZW50bHkgc2VsZWN0ZWQgXCJhMVwiXG4gIGNvb3JkaW5hdGVzPzogYm9vbGVhbjsgLy8gaW5jbHVkZSBjb29yZHMgYXR0cmlidXRlc1xuICBhdXRvQ2FzdGxlPzogYm9vbGVhbjsgLy8gaW1tZWRpYXRlbHkgY29tcGxldGUgdGhlIGNhc3RsZSBieSBtb3ZpbmcgdGhlIHJvb2sgYWZ0ZXIga2luZyBtb3ZlXG4gIHZpZXdPbmx5PzogYm9vbGVhbjsgLy8gZG9uJ3QgYmluZCBldmVudHM6IHRoZSB1c2VyIHdpbGwgbmV2ZXIgYmUgYWJsZSB0byBtb3ZlIHBpZWNlcyBhcm91bmRcbiAgZGlzYWJsZUNvbnRleHRNZW51PzogYm9vbGVhbjsgLy8gYmVjYXVzZSB3aG8gbmVlZHMgYSBjb250ZXh0IG1lbnUgb24gYSBjaGVzc2JvYXJkXG4gIHJlc2l6YWJsZT86IGJvb2xlYW47IC8vIGxpc3RlbnMgdG8gY2hlc3Nncm91bmQucmVzaXplIG9uIGRvY3VtZW50LmJvZHkgdG8gY2xlYXIgYm91bmRzIGNhY2hlXG4gIGFkZFBpZWNlWkluZGV4PzogYm9vbGVhbjsgLy8gYWRkcyB6LWluZGV4IHZhbHVlcyB0byBwaWVjZXMgKGZvciAzRClcbiAgLy8gcGllY2VLZXk6IGJvb2xlYW47IC8vIGFkZCBhIGRhdGEta2V5IGF0dHJpYnV0ZSB0byBwaWVjZSBlbGVtZW50c1xuICBoaWdobGlnaHQ/OiB7XG4gICAgbGFzdE1vdmU/OiBib29sZWFuOyAvLyBhZGQgbGFzdC1tb3ZlIGNsYXNzIHRvIHNxdWFyZXNcbiAgICBjaGVjaz86IGJvb2xlYW47IC8vIGFkZCBjaGVjayBjbGFzcyB0byBzcXVhcmVzXG4gIH07XG4gIGFuaW1hdGlvbj86IHtcbiAgICBlbmFibGVkPzogYm9vbGVhbjtcbiAgICBkdXJhdGlvbj86IG51bWJlcjtcbiAgfTtcbiAgbW92YWJsZT86IHtcbiAgICBmcmVlPzogYm9vbGVhbjsgLy8gYWxsIG1vdmVzIGFyZSB2YWxpZCAtIGJvYXJkIGVkaXRvclxuICAgIGNvbG9yPzogY2cuQ29sb3IgfCAnYm90aCc7IC8vIGNvbG9yIHRoYXQgY2FuIG1vdmUuIHdoaXRlIHwgYmxhY2sgfCBib3RoIHwgdW5kZWZpbmVkXG4gICAgZGVzdHM/OiB7XG4gICAgICBba2V5OiBzdHJpbmddOiBjZy5LZXlbXVxuICAgIH07IC8vIHZhbGlkIG1vdmVzLiB7XCJhMlwiIFtcImEzXCIgXCJhNFwiXSBcImIxXCIgW1wiYTNcIiBcImMzXCJdfVxuICAgIHNob3dEZXN0cz86IGJvb2xlYW47IC8vIHdoZXRoZXIgdG8gYWRkIHRoZSBtb3ZlLWRlc3QgY2xhc3Mgb24gc3F1YXJlc1xuICAgIGV2ZW50cz86IHtcbiAgICAgIGFmdGVyPzogKG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5LCBtZXRhZGF0YTogY2cuTW92ZU1ldGFkYXRhKSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgdGhlIG1vdmUgaGFzIGJlZW4gcGxheWVkXG4gICAgICBhZnRlck5ld1BpZWNlPzogKHJvbGU6IGNnLlJvbGUsIGtleTogY2cuS2V5LCBtZXRhZGF0YTogY2cuTW92ZU1ldGFkYXRhKSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgYSBuZXcgcGllY2UgaXMgZHJvcHBlZCBvbiB0aGUgYm9hcmRcbiAgICB9O1xuICAgIHJvb2tDYXN0bGU/OiBib29sZWFuIC8vIGNhc3RsZSBieSBtb3ZpbmcgdGhlIGtpbmcgdG8gdGhlIHJvb2tcbiAgfTtcbiAgcHJlbW92YWJsZT86IHtcbiAgICBlbmFibGVkPzogYm9vbGVhbjsgLy8gYWxsb3cgcHJlbW92ZXMgZm9yIGNvbG9yIHRoYXQgY2FuIG5vdCBtb3ZlXG4gICAgc2hvd0Rlc3RzPzogYm9vbGVhbjsgLy8gd2hldGhlciB0byBhZGQgdGhlIHByZW1vdmUtZGVzdCBjbGFzcyBvbiBzcXVhcmVzXG4gICAgY2FzdGxlPzogYm9vbGVhbjsgLy8gd2hldGhlciB0byBhbGxvdyBraW5nIGNhc3RsZSBwcmVtb3Zlc1xuICAgIGRlc3RzPzogY2cuS2V5W107IC8vIHByZW1vdmUgZGVzdGluYXRpb25zIGZvciB0aGUgY3VycmVudCBzZWxlY3Rpb25cbiAgICBldmVudHM/OiB7XG4gICAgICBzZXQ/OiAob3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXksIG1ldGFkYXRhPzogY2cuU2V0UHJlbW92ZU1ldGFkYXRhKSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHByZW1vdmUgaGFzIGJlZW4gc2V0XG4gICAgICB1bnNldD86ICgpID0+IHZvaWQ7ICAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHByZW1vdmUgaGFzIGJlZW4gdW5zZXRcbiAgICB9XG4gIH07XG4gIHByZWRyb3BwYWJsZT86IHtcbiAgICBlbmFibGVkPzogYm9vbGVhbjsgLy8gYWxsb3cgcHJlZHJvcHMgZm9yIGNvbG9yIHRoYXQgY2FuIG5vdCBtb3ZlXG4gICAgZXZlbnRzPzoge1xuICAgICAgc2V0PzogKHJvbGU6IGNnLlJvbGUsIGtleTogY2cuS2V5KSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHByZWRyb3AgaGFzIGJlZW4gc2V0XG4gICAgICB1bnNldD86ICgpID0+IHZvaWQ7IC8vIGNhbGxlZCBhZnRlciB0aGUgcHJlZHJvcCBoYXMgYmVlbiB1bnNldFxuICAgIH1cbiAgfTtcbiAgZHJhZ2dhYmxlPzoge1xuICAgIGVuYWJsZWQ/OiBib29sZWFuOyAvLyBhbGxvdyBtb3ZlcyAmIHByZW1vdmVzIHRvIHVzZSBkcmFnJ24gZHJvcFxuICAgIGRpc3RhbmNlPzogbnVtYmVyOyAvLyBtaW5pbXVtIGRpc3RhbmNlIHRvIGluaXRpYXRlIGEgZHJhZzsgaW4gcGl4ZWxzXG4gICAgYXV0b0Rpc3RhbmNlPzogYm9vbGVhbjsgLy8gbGV0cyBjaGVzc2dyb3VuZCBzZXQgZGlzdGFuY2UgdG8gemVybyB3aGVuIHVzZXIgZHJhZ3MgcGllY2VzXG4gICAgY2VudGVyUGllY2U/OiBib29sZWFuOyAvLyBjZW50ZXIgdGhlIHBpZWNlIG9uIGN1cnNvciBhdCBkcmFnIHN0YXJ0XG4gICAgc2hvd0dob3N0PzogYm9vbGVhbjsgLy8gc2hvdyBnaG9zdCBvZiBwaWVjZSBiZWluZyBkcmFnZ2VkXG4gICAgZGVsZXRlT25Ecm9wT2ZmPzogYm9vbGVhbjsgLy8gZGVsZXRlIGEgcGllY2Ugd2hlbiBpdCBpcyBkcm9wcGVkIG9mZiB0aGUgYm9hcmRcbiAgfTtcbiAgc2VsZWN0YWJsZT86IHtcbiAgICAvLyBkaXNhYmxlIHRvIGVuZm9yY2UgZHJhZ2dpbmcgb3ZlciBjbGljay1jbGljayBtb3ZlXG4gICAgZW5hYmxlZD86IGJvb2xlYW5cbiAgfTtcbiAgZXZlbnRzPzoge1xuICAgIGNoYW5nZT86ICgpID0+IHZvaWQ7IC8vIGNhbGxlZCBhZnRlciB0aGUgc2l0dWF0aW9uIGNoYW5nZXMgb24gdGhlIGJvYXJkXG4gICAgLy8gY2FsbGVkIGFmdGVyIGEgcGllY2UgaGFzIGJlZW4gbW92ZWQuXG4gICAgLy8gY2FwdHVyZWRQaWVjZSBpcyB1bmRlZmluZWQgb3IgbGlrZSB7Y29sb3I6ICd3aGl0ZSc7ICdyb2xlJzogJ3F1ZWVuJ31cbiAgICBtb3ZlPzogKG9yaWc6IGNnLktleSwgZGVzdDogY2cuS2V5LCBjYXB0dXJlZFBpZWNlPzogY2cuUGllY2UpID0+IHZvaWQ7XG4gICAgZHJvcE5ld1BpZWNlPzogKHBpZWNlOiBjZy5QaWVjZSwga2V5OiBjZy5LZXkpID0+IHZvaWQ7XG4gICAgc2VsZWN0PzogKGtleTogY2cuS2V5KSA9PiB2b2lkOyAvLyBjYWxsZWQgd2hlbiBhIHNxdWFyZSBpcyBzZWxlY3RlZFxuICAgIGluc2VydD86IChlbGVtZW50czogY2cuRWxlbWVudHMpID0+IHZvaWQ7IC8vIHdoZW4gdGhlIGJvYXJkIERPTSBoYXMgYmVlbiAocmUpaW5zZXJ0ZWRcbiAgfTtcbiAgZHJhd2FibGU/OiB7XG4gICAgZW5hYmxlZD86IGJvb2xlYW47IC8vIGNhbiBkcmF3XG4gICAgdmlzaWJsZT86IGJvb2xlYW47IC8vIGNhbiB2aWV3XG4gICAgZXJhc2VPbkNsaWNrPzogYm9vbGVhbjtcbiAgICBzaGFwZXM/OiBEcmF3U2hhcGVbXTtcbiAgICBhdXRvU2hhcGVzPzogRHJhd1NoYXBlW107XG4gICAgYnJ1c2hlcz86IERyYXdCcnVzaFtdO1xuICAgIHBpZWNlcz86IHtcbiAgICAgIGJhc2VVcmw/OiBzdHJpbmc7XG4gICAgfVxuICB9O1xuICBnZW9tZXRyeT86IGNnLkdlb21ldHJ5OyAvLyBkaW04eDggfCBkaW05eDkgfCBkaW0xMHg4IHwgZGltOXgxMFxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uZmlndXJlKHN0YXRlOiBTdGF0ZSwgY29uZmlnOiBDb25maWcpIHtcblxuICAvLyBkb24ndCBtZXJnZSBkZXN0aW5hdGlvbnMuIEp1c3Qgb3ZlcnJpZGUuXG4gIGlmIChjb25maWcubW92YWJsZSAmJiBjb25maWcubW92YWJsZS5kZXN0cykgc3RhdGUubW92YWJsZS5kZXN0cyA9IHVuZGVmaW5lZDtcblxuICBtZXJnZShzdGF0ZSwgY29uZmlnKTtcblxuICBpZiAoY29uZmlnLmdlb21ldHJ5KSBzdGF0ZS5kaW1lbnNpb25zID0gY2cuZGltZW5zaW9uc1tjb25maWcuZ2VvbWV0cnldO1xuXG4gIC8vIGlmIGEgZmVuIHdhcyBwcm92aWRlZCwgcmVwbGFjZSB0aGUgcGllY2VzXG4gIGlmIChjb25maWcuZmVuKSB7XG4gICAgc3RhdGUucGllY2VzID0gZmVuUmVhZChjb25maWcuZmVuKTtcbiAgICBzdGF0ZS5kcmF3YWJsZS5zaGFwZXMgPSBbXTtcbiAgfVxuXG4gIC8vIGFwcGx5IGNvbmZpZyB2YWx1ZXMgdGhhdCBjb3VsZCBiZSB1bmRlZmluZWQgeWV0IG1lYW5pbmdmdWxcbiAgaWYgKGNvbmZpZy5oYXNPd25Qcm9wZXJ0eSgnY2hlY2snKSkgc2V0Q2hlY2soc3RhdGUsIGNvbmZpZy5jaGVjayB8fCBmYWxzZSk7XG4gIGlmIChjb25maWcuaGFzT3duUHJvcGVydHkoJ2xhc3RNb3ZlJykgJiYgIWNvbmZpZy5sYXN0TW92ZSkgc3RhdGUubGFzdE1vdmUgPSB1bmRlZmluZWQ7XG4gIC8vIGluIGNhc2Ugb2YgWkggZHJvcCBsYXN0IG1vdmUsIHRoZXJlJ3MgYSBzaW5nbGUgc3F1YXJlLlxuICAvLyBpZiB0aGUgcHJldmlvdXMgbGFzdCBtb3ZlIGhhZCB0d28gc3F1YXJlcyxcbiAgLy8gdGhlIG1lcmdlIGFsZ29yaXRobSB3aWxsIGluY29ycmVjdGx5IGtlZXAgdGhlIHNlY29uZCBzcXVhcmUuXG4gIGVsc2UgaWYgKGNvbmZpZy5sYXN0TW92ZSkgc3RhdGUubGFzdE1vdmUgPSBjb25maWcubGFzdE1vdmU7XG5cbiAgLy8gZml4IG1vdmUvcHJlbW92ZSBkZXN0c1xuICBpZiAoc3RhdGUuc2VsZWN0ZWQpIHNldFNlbGVjdGVkKHN0YXRlLCBzdGF0ZS5zZWxlY3RlZCk7XG5cbiAgLy8gbm8gbmVlZCBmb3Igc3VjaCBzaG9ydCBhbmltYXRpb25zXG4gIGlmICghc3RhdGUuYW5pbWF0aW9uLmR1cmF0aW9uIHx8IHN0YXRlLmFuaW1hdGlvbi5kdXJhdGlvbiA8IDEwMCkgc3RhdGUuYW5pbWF0aW9uLmVuYWJsZWQgPSBmYWxzZTtcblxuICBpZiAoIXN0YXRlLm1vdmFibGUucm9va0Nhc3RsZSAmJiBzdGF0ZS5tb3ZhYmxlLmRlc3RzKSB7XG4gICAgY29uc3QgcmFuayA9IHN0YXRlLm1vdmFibGUuY29sb3IgPT09ICd3aGl0ZScgPyAxIDogOCxcbiAgICBraW5nU3RhcnRQb3MgPSAnZScgKyByYW5rLFxuICAgIGRlc3RzID0gc3RhdGUubW92YWJsZS5kZXN0c1traW5nU3RhcnRQb3NdLFxuICAgIGtpbmcgPSBzdGF0ZS5waWVjZXNba2luZ1N0YXJ0UG9zXTtcbiAgICBpZiAoIWRlc3RzIHx8ICFraW5nIHx8IGtpbmcucm9sZSAhPT0gJ2tpbmcnKSByZXR1cm47XG4gICAgc3RhdGUubW92YWJsZS5kZXN0c1traW5nU3RhcnRQb3NdID0gZGVzdHMuZmlsdGVyKGQgPT5cbiAgICAgICEoKGQgPT09ICdhJyArIHJhbmspICYmIGRlc3RzLmluZGV4T2YoJ2MnICsgcmFuayBhcyBjZy5LZXkpICE9PSAtMSkgJiZcbiAgICAgICAgISgoZCA9PT0gJ2gnICsgcmFuaykgJiYgZGVzdHMuaW5kZXhPZignZycgKyByYW5rIGFzIGNnLktleSkgIT09IC0xKVxuICAgICk7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIG1lcmdlKGJhc2U6IGFueSwgZXh0ZW5kOiBhbnkpIHtcbiAgZm9yIChsZXQga2V5IGluIGV4dGVuZCkge1xuICAgIGlmIChpc09iamVjdChiYXNlW2tleV0pICYmIGlzT2JqZWN0KGV4dGVuZFtrZXldKSkgbWVyZ2UoYmFzZVtrZXldLCBleHRlbmRba2V5XSk7XG4gICAgZWxzZSBiYXNlW2tleV0gPSBleHRlbmRba2V5XTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc09iamVjdChvOiBhbnkpOiBib29sZWFuIHtcbiAgcmV0dXJuIHR5cGVvZiBvID09PSAnb2JqZWN0Jztcbn1cbiIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcbmltcG9ydCAqIGFzIGJvYXJkIGZyb20gJy4vYm9hcmQnXG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCdcbmltcG9ydCB7IGNsZWFyIGFzIGRyYXdDbGVhciB9IGZyb20gJy4vZHJhdydcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXG5pbXBvcnQgeyBhbmltIH0gZnJvbSAnLi9hbmltJ1xuXG5leHBvcnQgaW50ZXJmYWNlIERyYWdDdXJyZW50IHtcbiAgb3JpZzogY2cuS2V5OyAvLyBvcmlnIGtleSBvZiBkcmFnZ2luZyBwaWVjZVxuICBvcmlnUG9zOiBjZy5Qb3M7XG4gIHBpZWNlOiBjZy5QaWVjZTtcbiAgcmVsOiBjZy5OdW1iZXJQYWlyOyAvLyB4OyB5IG9mIHRoZSBwaWVjZSBhdCBvcmlnaW5hbCBwb3NpdGlvblxuICBlcG9zOiBjZy5OdW1iZXJQYWlyOyAvLyBpbml0aWFsIGV2ZW50IHBvc2l0aW9uXG4gIHBvczogY2cuTnVtYmVyUGFpcjsgLy8gcmVsYXRpdmUgY3VycmVudCBwb3NpdGlvblxuICBkZWM6IGNnLk51bWJlclBhaXI7IC8vIHBpZWNlIGNlbnRlciBkZWNheVxuICBzdGFydGVkOiBib29sZWFuOyAvLyB3aGV0aGVyIHRoZSBkcmFnIGhhcyBzdGFydGVkOyBhcyBwZXIgdGhlIGRpc3RhbmNlIHNldHRpbmdcbiAgZWxlbWVudDogY2cuUGllY2VOb2RlIHwgKCgpID0+IGNnLlBpZWNlTm9kZSB8IHVuZGVmaW5lZCk7XG4gIG5ld1BpZWNlPzogYm9vbGVhbjsgLy8gaXQgaXQgYSBuZXcgcGllY2UgZnJvbSBvdXRzaWRlIHRoZSBib2FyZFxuICBmb3JjZT86IGJvb2xlYW47IC8vIGNhbiB0aGUgbmV3IHBpZWNlIHJlcGxhY2UgYW4gZXhpc3Rpbmcgb25lIChlZGl0b3IpXG4gIHByZXZpb3VzbHlTZWxlY3RlZD86IGNnLktleTtcbiAgb3JpZ2luVGFyZ2V0OiBFdmVudFRhcmdldCB8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGFydChzOiBTdGF0ZSwgZTogY2cuTW91Y2hFdmVudCk6IHZvaWQge1xuICBpZiAoZS5idXR0b24gIT09IHVuZGVmaW5lZCAmJiBlLmJ1dHRvbiAhPT0gMCkgcmV0dXJuOyAvLyBvbmx5IHRvdWNoIG9yIGxlZnQgY2xpY2tcbiAgaWYgKGUudG91Y2hlcyAmJiBlLnRvdWNoZXMubGVuZ3RoID4gMSkgcmV0dXJuOyAvLyBzdXBwb3J0IG9uZSBmaW5nZXIgdG91Y2ggb25seVxuICBjb25zdCBib3VuZHMgPSBzLmRvbS5ib3VuZHMoKSxcbiAgcG9zaXRpb24gPSB1dGlsLmV2ZW50UG9zaXRpb24oZSkgYXMgY2cuTnVtYmVyUGFpcixcbiAgb3JpZyA9IGJvYXJkLmdldEtleUF0RG9tUG9zKHBvc2l0aW9uLCBib2FyZC53aGl0ZVBvdihzKSwgYm91bmRzLCBzLmdlb21ldHJ5KTtcbiAgaWYgKCFvcmlnKSByZXR1cm47XG4gIGNvbnN0IHBpZWNlID0gcy5waWVjZXNbb3JpZ107XG4gIGNvbnN0IHByZXZpb3VzbHlTZWxlY3RlZCA9IHMuc2VsZWN0ZWQ7XG4gIGlmICghcHJldmlvdXNseVNlbGVjdGVkICYmIHMuZHJhd2FibGUuZW5hYmxlZCAmJiAoXG4gICAgcy5kcmF3YWJsZS5lcmFzZU9uQ2xpY2sgfHwgKCFwaWVjZSB8fCBwaWVjZS5jb2xvciAhPT0gcy50dXJuQ29sb3IpXG4gICkpIGRyYXdDbGVhcihzKTtcbiAgLy8gUHJldmVudCB0b3VjaCBzY3JvbGwgYW5kIGNyZWF0ZSBubyBjb3JyZXNwb25kaW5nIG1vdXNlIGV2ZW50LCBpZiB0aGVyZVxuICAvLyBpcyBhbiBpbnRlbnQgdG8gaW50ZXJhY3Qgd2l0aCB0aGUgYm9hcmQuIElmIG5vIGNvbG9yIGlzIG1vdmFibGVcbiAgLy8gKGFuZCB0aGUgYm9hcmQgaXMgbm90IGZvciB2aWV3aW5nIG9ubHkpLCB0b3VjaGVzIGFyZSBsaWtlbHkgaW50ZW5kZWQgdG9cbiAgLy8gc2VsZWN0IHNxdWFyZXMuXG4gIGlmIChlLmNhbmNlbGFibGUgIT09IGZhbHNlICYmXG4gICAgICAoIWUudG91Y2hlcyB8fCAhcy5tb3ZhYmxlLmNvbG9yIHx8IHBpZWNlIHx8IHByZXZpb3VzbHlTZWxlY3RlZCB8fCBwaWVjZUNsb3NlVG8ocywgcG9zaXRpb24pKSlcbiAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIGNvbnN0IGhhZFByZW1vdmUgPSAhIXMucHJlbW92YWJsZS5jdXJyZW50O1xuICBjb25zdCBoYWRQcmVkcm9wID0gISFzLnByZWRyb3BwYWJsZS5jdXJyZW50O1xuICBzLnN0YXRzLmN0cmxLZXkgPSBlLmN0cmxLZXk7XG4gIGlmIChzLnNlbGVjdGVkICYmIGJvYXJkLmNhbk1vdmUocywgcy5zZWxlY3RlZCwgb3JpZykpIHtcbiAgICBhbmltKHN0YXRlID0+IGJvYXJkLnNlbGVjdFNxdWFyZShzdGF0ZSwgb3JpZyksIHMpO1xuICB9IGVsc2Uge1xuICAgIGJvYXJkLnNlbGVjdFNxdWFyZShzLCBvcmlnKTtcbiAgfVxuICBjb25zdCBzdGlsbFNlbGVjdGVkID0gcy5zZWxlY3RlZCA9PT0gb3JpZztcbiAgY29uc3QgZWxlbWVudCA9IHBpZWNlRWxlbWVudEJ5S2V5KHMsIG9yaWcpO1xuICBjb25zdCBmaXJzdFJhbmtJczAgPSBzLmRpbWVuc2lvbnMuaGVpZ2h0ID09PSAxMDtcbiAgaWYgKHBpZWNlICYmIGVsZW1lbnQgJiYgc3RpbGxTZWxlY3RlZCAmJiBib2FyZC5pc0RyYWdnYWJsZShzLCBvcmlnKSkge1xuICAgIGNvbnN0IHNxdWFyZUJvdW5kcyA9IGNvbXB1dGVTcXVhcmVCb3VuZHMob3JpZywgYm9hcmQud2hpdGVQb3YocyksIGJvdW5kcywgcy5kaW1lbnNpb25zKTtcbiAgICBzLmRyYWdnYWJsZS5jdXJyZW50ID0ge1xuICAgICAgb3JpZyxcbiAgICAgIG9yaWdQb3M6IHV0aWwua2V5MnBvcyhvcmlnLCBmaXJzdFJhbmtJczApLFxuICAgICAgcGllY2UsXG4gICAgICByZWw6IHBvc2l0aW9uLFxuICAgICAgZXBvczogcG9zaXRpb24sXG4gICAgICBwb3M6IFswLCAwXSxcbiAgICAgIGRlYzogcy5kcmFnZ2FibGUuY2VudGVyUGllY2UgPyBbXG4gICAgICAgIHBvc2l0aW9uWzBdIC0gKHNxdWFyZUJvdW5kcy5sZWZ0ICsgc3F1YXJlQm91bmRzLndpZHRoIC8gMiksXG4gICAgICAgIHBvc2l0aW9uWzFdIC0gKHNxdWFyZUJvdW5kcy50b3AgKyBzcXVhcmVCb3VuZHMuaGVpZ2h0IC8gMilcbiAgICAgIF0gOiBbMCwgMF0sXG4gICAgICBzdGFydGVkOiBzLmRyYWdnYWJsZS5hdXRvRGlzdGFuY2UgJiYgcy5zdGF0cy5kcmFnZ2VkLFxuICAgICAgZWxlbWVudCxcbiAgICAgIHByZXZpb3VzbHlTZWxlY3RlZCxcbiAgICAgIG9yaWdpblRhcmdldDogZS50YXJnZXRcbiAgICB9O1xuICAgIGVsZW1lbnQuY2dEcmFnZ2luZyA9IHRydWU7XG4gICAgZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdkcmFnZ2luZycpO1xuICAgIC8vIHBsYWNlIGdob3N0XG4gICAgY29uc3QgZ2hvc3QgPSBzLmRvbS5lbGVtZW50cy5naG9zdDtcbiAgICBpZiAoZ2hvc3QpIHtcbiAgICAgIGdob3N0LmNsYXNzTmFtZSA9IGBnaG9zdCAke3BpZWNlLmNvbG9yfSAke3BpZWNlLnJvbGV9YDtcbiAgICAgIHV0aWwudHJhbnNsYXRlQWJzKGdob3N0LCB1dGlsLnBvc1RvVHJhbnNsYXRlQWJzKGJvdW5kcywgcy5kaW1lbnNpb25zKSh1dGlsLmtleTJwb3Mob3JpZywgZmlyc3RSYW5rSXMwKSwgYm9hcmQud2hpdGVQb3YocykpKTtcbiAgICAgIHV0aWwuc2V0VmlzaWJsZShnaG9zdCwgdHJ1ZSk7XG4gICAgfVxuICAgIHByb2Nlc3NEcmFnKHMpO1xuICB9IGVsc2Uge1xuICAgIGlmIChoYWRQcmVtb3ZlKSBib2FyZC51bnNldFByZW1vdmUocyk7XG4gICAgaWYgKGhhZFByZWRyb3ApIGJvYXJkLnVuc2V0UHJlZHJvcChzKTtcbiAgfVxuICBzLmRvbS5yZWRyYXcoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBpZWNlQ2xvc2VUbyhzOiBTdGF0ZSwgcG9zOiBjZy5Qb3MpOiBib29sZWFuIHtcbiAgY29uc3QgYXNXaGl0ZSA9IGJvYXJkLndoaXRlUG92KHMpLFxuICBib3VuZHMgPSBzLmRvbS5ib3VuZHMoKSxcbiAgcmFkaXVzU3EgPSBNYXRoLnBvdyhib3VuZHMud2lkdGggLyA4LCAyKTtcbiAgZm9yIChsZXQga2V5IGluIHMucGllY2VzKSB7XG4gICAgY29uc3Qgc3F1YXJlQm91bmRzID0gY29tcHV0ZVNxdWFyZUJvdW5kcyhrZXkgYXMgY2cuS2V5LCBhc1doaXRlLCBib3VuZHMsIHMuZGltZW5zaW9ucyksXG4gICAgY2VudGVyOiBjZy5Qb3MgPSBbXG4gICAgICBzcXVhcmVCb3VuZHMubGVmdCArIHNxdWFyZUJvdW5kcy53aWR0aCAvIDIsXG4gICAgICBzcXVhcmVCb3VuZHMudG9wICsgc3F1YXJlQm91bmRzLmhlaWdodCAvIDJcbiAgICBdO1xuICAgIGlmICh1dGlsLmRpc3RhbmNlU3EoY2VudGVyLCBwb3MpIDw9IHJhZGl1c1NxKSByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkcmFnTmV3UGllY2UoczogU3RhdGUsIHBpZWNlOiBjZy5QaWVjZSwgZTogY2cuTW91Y2hFdmVudCwgZm9yY2U/OiBib29sZWFuKTogdm9pZCB7XG5cbiAgY29uc3Qga2V5OiBjZy5LZXkgPSAnYTAnO1xuXG4gIHMucGllY2VzW2tleV0gPSBwaWVjZTtcblxuICBzLmRvbS5yZWRyYXcoKTtcblxuICBjb25zdCBwb3NpdGlvbiA9IHV0aWwuZXZlbnRQb3NpdGlvbihlKSBhcyBjZy5OdW1iZXJQYWlyLFxuICBhc1doaXRlID0gYm9hcmQud2hpdGVQb3YocyksXG4gIGJvdW5kcyA9IHMuZG9tLmJvdW5kcygpLFxuICBzcXVhcmVCb3VuZHMgPSBjb21wdXRlU3F1YXJlQm91bmRzKGtleSwgYXNXaGl0ZSwgYm91bmRzLCBzLmRpbWVuc2lvbnMpO1xuXG4gIGNvbnN0IHJlbDogY2cuTnVtYmVyUGFpciA9IFtcbiAgICAoYXNXaGl0ZSA/IDAgOiBzLmRpbWVuc2lvbnMud2lkdGggLSAxKSAqIHNxdWFyZUJvdW5kcy53aWR0aCArIGJvdW5kcy5sZWZ0LFxuICAgIChhc1doaXRlID8gcy5kaW1lbnNpb25zLmhlaWdodCA6IC0xKSAqIHNxdWFyZUJvdW5kcy5oZWlnaHQgKyBib3VuZHMudG9wXG4gIF07XG5cbiAgY29uc3QgZmlyc3RSYW5rSXMwID0gcy5kaW1lbnNpb25zLmhlaWdodCA9PT0gMTA7XG4gIHMuZHJhZ2dhYmxlLmN1cnJlbnQgPSB7XG4gICAgb3JpZzoga2V5LFxuICAgIG9yaWdQb3M6IHV0aWwua2V5MnBvcyhrZXksIGZpcnN0UmFua0lzMCksXG4gICAgcGllY2UsXG4gICAgcmVsLFxuICAgIGVwb3M6IHBvc2l0aW9uLFxuICAgIHBvczogW3Bvc2l0aW9uWzBdIC0gcmVsWzBdLCBwb3NpdGlvblsxXSAtIHJlbFsxXV0sXG4gICAgZGVjOiBbLXNxdWFyZUJvdW5kcy53aWR0aCAvIDIsIC1zcXVhcmVCb3VuZHMuaGVpZ2h0IC8gMl0sXG4gICAgc3RhcnRlZDogdHJ1ZSxcbiAgICBlbGVtZW50OiAoKSA9PiBwaWVjZUVsZW1lbnRCeUtleShzLCBrZXkpLFxuICAgIG9yaWdpblRhcmdldDogZS50YXJnZXQsXG4gICAgbmV3UGllY2U6IHRydWUsXG4gICAgZm9yY2U6ICEhZm9yY2VcbiAgfTtcbiAgcHJvY2Vzc0RyYWcocyk7XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NEcmFnKHM6IFN0YXRlKTogdm9pZCB7XG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgY29uc3QgY3VyID0gcy5kcmFnZ2FibGUuY3VycmVudDtcbiAgICBpZiAoIWN1cikgcmV0dXJuO1xuICAgIC8vIGNhbmNlbCBhbmltYXRpb25zIHdoaWxlIGRyYWdnaW5nXG4gICAgaWYgKHMuYW5pbWF0aW9uLmN1cnJlbnQgJiYgcy5hbmltYXRpb24uY3VycmVudC5wbGFuLmFuaW1zW2N1ci5vcmlnXSkgcy5hbmltYXRpb24uY3VycmVudCA9IHVuZGVmaW5lZDtcbiAgICAvLyBpZiBtb3ZpbmcgcGllY2UgaXMgZ29uZSwgY2FuY2VsXG4gICAgY29uc3Qgb3JpZ1BpZWNlID0gcy5waWVjZXNbY3VyLm9yaWddO1xuICAgIGlmICghb3JpZ1BpZWNlIHx8ICF1dGlsLnNhbWVQaWVjZShvcmlnUGllY2UsIGN1ci5waWVjZSkpIGNhbmNlbChzKTtcbiAgICBlbHNlIHtcbiAgICAgIGlmICghY3VyLnN0YXJ0ZWQgJiYgdXRpbC5kaXN0YW5jZVNxKGN1ci5lcG9zLCBjdXIucmVsKSA+PSBNYXRoLnBvdyhzLmRyYWdnYWJsZS5kaXN0YW5jZSwgMikpIGN1ci5zdGFydGVkID0gdHJ1ZTtcbiAgICAgIGlmIChjdXIuc3RhcnRlZCkge1xuXG4gICAgICAgIC8vIHN1cHBvcnQgbGF6eSBlbGVtZW50c1xuICAgICAgICBpZiAodHlwZW9mIGN1ci5lbGVtZW50ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgY29uc3QgZm91bmQgPSBjdXIuZWxlbWVudCgpO1xuICAgICAgICAgIGlmICghZm91bmQpIHJldHVybjtcbiAgICAgICAgICBmb3VuZC5jZ0RyYWdnaW5nID0gdHJ1ZTtcbiAgICAgICAgICBmb3VuZC5jbGFzc0xpc3QuYWRkKCdkcmFnZ2luZycpO1xuICAgICAgICAgIGN1ci5lbGVtZW50ID0gZm91bmQ7XG4gICAgICAgIH1cblxuICAgICAgICBjdXIucG9zID0gW1xuICAgICAgICAgIGN1ci5lcG9zWzBdIC0gY3VyLnJlbFswXSxcbiAgICAgICAgICBjdXIuZXBvc1sxXSAtIGN1ci5yZWxbMV1cbiAgICAgICAgXTtcblxuICAgICAgICAvLyBtb3ZlIHBpZWNlXG4gICAgICAgIGNvbnN0IHRyYW5zbGF0aW9uID0gdXRpbC5wb3NUb1RyYW5zbGF0ZUFicyhzLmRvbS5ib3VuZHMoKSwgcy5kaW1lbnNpb25zKShjdXIub3JpZ1BvcywgYm9hcmQud2hpdGVQb3YocykpO1xuICAgICAgICB0cmFuc2xhdGlvblswXSArPSBjdXIucG9zWzBdICsgY3VyLmRlY1swXTtcbiAgICAgICAgdHJhbnNsYXRpb25bMV0gKz0gY3VyLnBvc1sxXSArIGN1ci5kZWNbMV07XG4gICAgICAgIHV0aWwudHJhbnNsYXRlQWJzKGN1ci5lbGVtZW50LCB0cmFuc2xhdGlvbik7XG4gICAgICB9XG4gICAgfVxuICAgIHByb2Nlc3NEcmFnKHMpO1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vdmUoczogU3RhdGUsIGU6IGNnLk1vdWNoRXZlbnQpOiB2b2lkIHtcbiAgLy8gc3VwcG9ydCBvbmUgZmluZ2VyIHRvdWNoIG9ubHlcbiAgaWYgKHMuZHJhZ2dhYmxlLmN1cnJlbnQgJiYgKCFlLnRvdWNoZXMgfHwgZS50b3VjaGVzLmxlbmd0aCA8IDIpKSB7XG4gICAgcy5kcmFnZ2FibGUuY3VycmVudC5lcG9zID0gdXRpbC5ldmVudFBvc2l0aW9uKGUpIGFzIGNnLk51bWJlclBhaXI7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuZChzOiBTdGF0ZSwgZTogY2cuTW91Y2hFdmVudCk6IHZvaWQge1xuICBjb25zdCBjdXIgPSBzLmRyYWdnYWJsZS5jdXJyZW50O1xuICBpZiAoIWN1cikgcmV0dXJuO1xuICAvLyBjcmVhdGUgbm8gY29ycmVzcG9uZGluZyBtb3VzZSBldmVudFxuICBpZiAoZS50eXBlID09PSAndG91Y2hlbmQnICYmIGUuY2FuY2VsYWJsZSAhPT0gZmFsc2UpIGUucHJldmVudERlZmF1bHQoKTtcbiAgLy8gY29tcGFyaW5nIHdpdGggdGhlIG9yaWdpbiB0YXJnZXQgaXMgYW4gZWFzeSB3YXkgdG8gdGVzdCB0aGF0IHRoZSBlbmQgZXZlbnRcbiAgLy8gaGFzIHRoZSBzYW1lIHRvdWNoIG9yaWdpblxuICBpZiAoZS50eXBlID09PSAndG91Y2hlbmQnICYmIGN1ciAmJiBjdXIub3JpZ2luVGFyZ2V0ICE9PSBlLnRhcmdldCAmJiAhY3VyLm5ld1BpZWNlKSB7XG4gICAgcy5kcmFnZ2FibGUuY3VycmVudCA9IHVuZGVmaW5lZDtcbiAgICByZXR1cm47XG4gIH1cbiAgYm9hcmQudW5zZXRQcmVtb3ZlKHMpO1xuICBib2FyZC51bnNldFByZWRyb3Aocyk7XG4gIC8vIHRvdWNoZW5kIGhhcyBubyBwb3NpdGlvbjsgc28gdXNlIHRoZSBsYXN0IHRvdWNobW92ZSBwb3NpdGlvbiBpbnN0ZWFkXG4gIGNvbnN0IGV2ZW50UG9zOiBjZy5OdW1iZXJQYWlyID0gdXRpbC5ldmVudFBvc2l0aW9uKGUpIHx8IGN1ci5lcG9zO1xuICBjb25zdCBkZXN0ID0gYm9hcmQuZ2V0S2V5QXREb21Qb3MoZXZlbnRQb3MsIGJvYXJkLndoaXRlUG92KHMpLCBzLmRvbS5ib3VuZHMoKSwgcy5nZW9tZXRyeSk7XG4gIGlmIChkZXN0ICYmIGN1ci5zdGFydGVkICYmIGN1ci5vcmlnICE9PSBkZXN0KSB7XG4gICAgaWYgKGN1ci5uZXdQaWVjZSkgYm9hcmQuZHJvcE5ld1BpZWNlKHMsIGN1ci5vcmlnLCBkZXN0LCBjdXIuZm9yY2UpO1xuICAgIGVsc2Uge1xuICAgICAgcy5zdGF0cy5jdHJsS2V5ID0gZS5jdHJsS2V5O1xuICAgICAgaWYgKGJvYXJkLnVzZXJNb3ZlKHMsIGN1ci5vcmlnLCBkZXN0KSkgcy5zdGF0cy5kcmFnZ2VkID0gdHJ1ZTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoY3VyLm5ld1BpZWNlKSB7XG4gICAgZGVsZXRlIHMucGllY2VzW2N1ci5vcmlnXTtcbiAgfSBlbHNlIGlmIChzLmRyYWdnYWJsZS5kZWxldGVPbkRyb3BPZmYgJiYgIWRlc3QpIHtcbiAgICBkZWxldGUgcy5waWVjZXNbY3VyLm9yaWddO1xuICAgIGJvYXJkLmNhbGxVc2VyRnVuY3Rpb24ocy5ldmVudHMuY2hhbmdlKTtcbiAgfVxuICBpZiAoY3VyICYmIGN1ci5vcmlnID09PSBjdXIucHJldmlvdXNseVNlbGVjdGVkICYmIChjdXIub3JpZyA9PT0gZGVzdCB8fCAhZGVzdCkpXG4gICAgYm9hcmQudW5zZWxlY3Qocyk7XG4gIGVsc2UgaWYgKCFzLnNlbGVjdGFibGUuZW5hYmxlZCkgYm9hcmQudW5zZWxlY3Qocyk7XG5cbiAgcmVtb3ZlRHJhZ0VsZW1lbnRzKHMpO1xuXG4gIHMuZHJhZ2dhYmxlLmN1cnJlbnQgPSB1bmRlZmluZWQ7XG4gIHMuZG9tLnJlZHJhdygpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FuY2VsKHM6IFN0YXRlKTogdm9pZCB7XG4gIGNvbnN0IGN1ciA9IHMuZHJhZ2dhYmxlLmN1cnJlbnQ7XG4gIGlmIChjdXIpIHtcbiAgICBpZiAoY3VyLm5ld1BpZWNlKSBkZWxldGUgcy5waWVjZXNbY3VyLm9yaWddO1xuICAgIHMuZHJhZ2dhYmxlLmN1cnJlbnQgPSB1bmRlZmluZWQ7XG4gICAgYm9hcmQudW5zZWxlY3Qocyk7XG4gICAgcmVtb3ZlRHJhZ0VsZW1lbnRzKHMpO1xuICAgIHMuZG9tLnJlZHJhdygpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZURyYWdFbGVtZW50cyhzOiBTdGF0ZSkge1xuICBjb25zdCBlID0gcy5kb20uZWxlbWVudHM7XG4gIGlmIChlLmdob3N0KSB1dGlsLnNldFZpc2libGUoZS5naG9zdCwgZmFsc2UpO1xufVxuXG5mdW5jdGlvbiBjb21wdXRlU3F1YXJlQm91bmRzKGtleTogY2cuS2V5LCBhc1doaXRlOiBib29sZWFuLCBib3VuZHM6IENsaWVudFJlY3QsIGJkOiBjZy5Cb2FyZERpbWVuc2lvbnMpIHtcbiAgY29uc3QgZmlyc3RSYW5rSXMwID0gYmQuaGVpZ2h0ID09PSAxMDtcbiAgY29uc3QgcG9zID0gdXRpbC5rZXkycG9zKGtleSwgZmlyc3RSYW5rSXMwKTtcbiAgaWYgKCFhc1doaXRlKSB7XG4gICAgcG9zWzBdID0gYmQud2lkdGggKyAxIC0gcG9zWzBdO1xuICAgIHBvc1sxXSA9IGJkLmhlaWdodCArIDEgLSBwb3NbMV07XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBsZWZ0OiBib3VuZHMubGVmdCArIGJvdW5kcy53aWR0aCAqIChwb3NbMF0gLSAxKSAvIGJkLndpZHRoLFxuICAgIHRvcDogYm91bmRzLnRvcCArIGJvdW5kcy5oZWlnaHQgKiAoYmQuaGVpZ2h0IC0gcG9zWzFdKSAvIGJkLmhlaWdodCxcbiAgICB3aWR0aDogYm91bmRzLndpZHRoIC8gYmQud2lkdGgsXG4gICAgaGVpZ2h0OiBib3VuZHMuaGVpZ2h0IC8gYmQuaGVpZ2h0XG4gIH07XG59XG5cbmZ1bmN0aW9uIHBpZWNlRWxlbWVudEJ5S2V5KHM6IFN0YXRlLCBrZXk6IGNnLktleSk6IGNnLlBpZWNlTm9kZSB8IHVuZGVmaW5lZCB7XG4gIGxldCBlbCA9IHMuZG9tLmVsZW1lbnRzLmJvYXJkLmZpcnN0Q2hpbGQgYXMgY2cuUGllY2VOb2RlO1xuICB3aGlsZSAoZWwpIHtcbiAgICBpZiAoZWwuY2dLZXkgPT09IGtleSAmJiBlbC50YWdOYW1lID09PSAnUElFQ0UnKSByZXR1cm4gZWw7XG4gICAgZWwgPSBlbC5uZXh0U2libGluZyBhcyBjZy5QaWVjZU5vZGU7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cbiIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcbmltcG9ydCB7IHVuc2VsZWN0LCBjYW5jZWxNb3ZlLCBnZXRLZXlBdERvbVBvcywgd2hpdGVQb3YgfSBmcm9tICcuL2JvYXJkJ1xuaW1wb3J0IHsgZXZlbnRQb3NpdGlvbiwgaXNSaWdodEJ1dHRvbiB9IGZyb20gJy4vdXRpbCdcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXG5cbmV4cG9ydCBpbnRlcmZhY2UgRHJhd1NoYXBlIHtcbiAgb3JpZzogY2cuS2V5O1xuICBkZXN0PzogY2cuS2V5O1xuICBicnVzaDogc3RyaW5nO1xuICBtb2RpZmllcnM/OiBEcmF3TW9kaWZpZXJzO1xuICBwaWVjZT86IERyYXdTaGFwZVBpZWNlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERyYXdTaGFwZVBpZWNlIHtcbiAgcm9sZTogY2cuUm9sZTtcbiAgY29sb3I6IGNnLkNvbG9yO1xuICBzY2FsZT86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEcmF3QnJ1c2gge1xuICBrZXk6IHN0cmluZztcbiAgY29sb3I6IHN0cmluZztcbiAgb3BhY2l0eTogbnVtYmVyO1xuICBsaW5lV2lkdGg6IG51bWJlclxufVxuXG5leHBvcnQgaW50ZXJmYWNlIERyYXdCcnVzaGVzIHtcbiAgW25hbWU6IHN0cmluZ106IERyYXdCcnVzaDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEcmF3TW9kaWZpZXJzIHtcbiAgbGluZVdpZHRoPzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERyYXdhYmxlIHtcbiAgZW5hYmxlZDogYm9vbGVhbjsgLy8gY2FuIGRyYXdcbiAgdmlzaWJsZTogYm9vbGVhbjsgLy8gY2FuIHZpZXdcbiAgZXJhc2VPbkNsaWNrOiBib29sZWFuO1xuICBvbkNoYW5nZT86IChzaGFwZXM6IERyYXdTaGFwZVtdKSA9PiB2b2lkO1xuICBzaGFwZXM6IERyYXdTaGFwZVtdOyAvLyB1c2VyIHNoYXBlc1xuICBhdXRvU2hhcGVzOiBEcmF3U2hhcGVbXTsgLy8gY29tcHV0ZXIgc2hhcGVzXG4gIGN1cnJlbnQ/OiBEcmF3Q3VycmVudDtcbiAgYnJ1c2hlczogRHJhd0JydXNoZXM7XG4gIC8vIGRyYXdhYmxlIFNWRyBwaWVjZXM7IHVzZWQgZm9yIGNyYXp5aG91c2UgZHJvcFxuICBwaWVjZXM6IHtcbiAgICBiYXNlVXJsOiBzdHJpbmdcbiAgfSxcbiAgcHJldlN2Z0hhc2g6IHN0cmluZ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERyYXdDdXJyZW50IHtcbiAgb3JpZzogY2cuS2V5OyAvLyBvcmlnIGtleSBvZiBkcmF3aW5nXG4gIGRlc3Q/OiBjZy5LZXk7IC8vIHNoYXBlIGRlc3QsIG9yIHVuZGVmaW5lZCBmb3IgY2lyY2xlXG4gIG1vdXNlU3E/OiBjZy5LZXk7IC8vIHNxdWFyZSBiZWluZyBtb3VzZWQgb3ZlclxuICBwb3M6IGNnLk51bWJlclBhaXI7IC8vIHJlbGF0aXZlIGN1cnJlbnQgcG9zaXRpb25cbiAgYnJ1c2g6IHN0cmluZzsgLy8gYnJ1c2ggbmFtZSBmb3Igc2hhcGVcbn1cblxuY29uc3QgYnJ1c2hlcyA9IFsnZ3JlZW4nLCAncmVkJywgJ2JsdWUnLCAneWVsbG93J107XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGFydChzdGF0ZTogU3RhdGUsIGU6IGNnLk1vdWNoRXZlbnQpOiB2b2lkIHtcbiAgaWYgKGUudG91Y2hlcyAmJiBlLnRvdWNoZXMubGVuZ3RoID4gMSkgcmV0dXJuOyAvLyBzdXBwb3J0IG9uZSBmaW5nZXIgdG91Y2ggb25seVxuICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIGUuY3RybEtleSA/IHVuc2VsZWN0KHN0YXRlKSA6IGNhbmNlbE1vdmUoc3RhdGUpO1xuICBjb25zdCBwb3MgPSBldmVudFBvc2l0aW9uKGUpIGFzIGNnLk51bWJlclBhaXIsXG4gIG9yaWcgPSBnZXRLZXlBdERvbVBvcyhwb3MsIHdoaXRlUG92KHN0YXRlKSwgc3RhdGUuZG9tLmJvdW5kcygpLCBzdGF0ZS5nZW9tZXRyeSk7XG4gIGlmICghb3JpZykgcmV0dXJuO1xuICBzdGF0ZS5kcmF3YWJsZS5jdXJyZW50ID0ge1xuICAgIG9yaWcsXG4gICAgcG9zLFxuICAgIGJydXNoOiBldmVudEJydXNoKGUpXG4gIH07XG4gIHByb2Nlc3NEcmF3KHN0YXRlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb2Nlc3NEcmF3KHN0YXRlOiBTdGF0ZSk6IHZvaWQge1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgIGNvbnN0IGN1ciA9IHN0YXRlLmRyYXdhYmxlLmN1cnJlbnQ7XG4gICAgaWYgKGN1cikge1xuICAgICAgY29uc3QgbW91c2VTcSA9IGdldEtleUF0RG9tUG9zKGN1ci5wb3MsIHdoaXRlUG92KHN0YXRlKSwgc3RhdGUuZG9tLmJvdW5kcygpLCBzdGF0ZS5nZW9tZXRyeSk7XG4gICAgICBpZiAobW91c2VTcSAhPT0gY3VyLm1vdXNlU3EpIHtcbiAgICAgICAgY3VyLm1vdXNlU3EgPSBtb3VzZVNxO1xuICAgICAgICBjdXIuZGVzdCA9IG1vdXNlU3EgIT09IGN1ci5vcmlnID8gbW91c2VTcSA6IHVuZGVmaW5lZDtcbiAgICAgICAgc3RhdGUuZG9tLnJlZHJhd05vdygpO1xuICAgICAgfVxuICAgICAgcHJvY2Vzc0RyYXcoc3RhdGUpO1xuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtb3ZlKHN0YXRlOiBTdGF0ZSwgZTogY2cuTW91Y2hFdmVudCk6IHZvaWQge1xuICBpZiAoc3RhdGUuZHJhd2FibGUuY3VycmVudCkgc3RhdGUuZHJhd2FibGUuY3VycmVudC5wb3MgPSBldmVudFBvc2l0aW9uKGUpIGFzIGNnLk51bWJlclBhaXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbmQoc3RhdGU6IFN0YXRlKTogdm9pZCB7XG4gIGNvbnN0IGN1ciA9IHN0YXRlLmRyYXdhYmxlLmN1cnJlbnQ7XG4gIGlmIChjdXIpIHtcbiAgICBpZiAoY3VyLm1vdXNlU3EpIGFkZFNoYXBlKHN0YXRlLmRyYXdhYmxlLCBjdXIpO1xuICAgIGNhbmNlbChzdGF0ZSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNhbmNlbChzdGF0ZTogU3RhdGUpOiB2b2lkIHtcbiAgaWYgKHN0YXRlLmRyYXdhYmxlLmN1cnJlbnQpIHtcbiAgICBzdGF0ZS5kcmF3YWJsZS5jdXJyZW50ID0gdW5kZWZpbmVkO1xuICAgIHN0YXRlLmRvbS5yZWRyYXcoKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xlYXIoc3RhdGU6IFN0YXRlKTogdm9pZCB7XG4gIGlmIChzdGF0ZS5kcmF3YWJsZS5zaGFwZXMubGVuZ3RoKSB7XG4gICAgc3RhdGUuZHJhd2FibGUuc2hhcGVzID0gW107XG4gICAgc3RhdGUuZG9tLnJlZHJhdygpO1xuICAgIG9uQ2hhbmdlKHN0YXRlLmRyYXdhYmxlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBldmVudEJydXNoKGU6IGNnLk1vdWNoRXZlbnQpOiBzdHJpbmcge1xuICByZXR1cm4gYnJ1c2hlc1soZS5zaGlmdEtleSAmJiBpc1JpZ2h0QnV0dG9uKGUpID8gMSA6IDApICsgKGUuYWx0S2V5ID8gMiA6IDApXTtcbn1cblxuZnVuY3Rpb24gYWRkU2hhcGUoZHJhd2FibGU6IERyYXdhYmxlLCBjdXI6IERyYXdDdXJyZW50KTogdm9pZCB7XG4gIGNvbnN0IHNhbWVTaGFwZSA9IChzOiBEcmF3U2hhcGUpID0+IHMub3JpZyA9PT0gY3VyLm9yaWcgJiYgcy5kZXN0ID09PSBjdXIuZGVzdDtcbiAgY29uc3Qgc2ltaWxhciA9IGRyYXdhYmxlLnNoYXBlcy5maWx0ZXIoc2FtZVNoYXBlKVswXTtcbiAgaWYgKHNpbWlsYXIpIGRyYXdhYmxlLnNoYXBlcyA9IGRyYXdhYmxlLnNoYXBlcy5maWx0ZXIocyA9PiAhc2FtZVNoYXBlKHMpKTtcbiAgaWYgKCFzaW1pbGFyIHx8IHNpbWlsYXIuYnJ1c2ggIT09IGN1ci5icnVzaCkgZHJhd2FibGUuc2hhcGVzLnB1c2goY3VyKTtcbiAgb25DaGFuZ2UoZHJhd2FibGUpO1xufVxuXG5mdW5jdGlvbiBvbkNoYW5nZShkcmF3YWJsZTogRHJhd2FibGUpOiB2b2lkIHtcbiAgaWYgKGRyYXdhYmxlLm9uQ2hhbmdlKSBkcmF3YWJsZS5vbkNoYW5nZShkcmF3YWJsZS5zaGFwZXMpO1xufVxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xuaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcydcbmltcG9ydCAqIGFzIGJvYXJkIGZyb20gJy4vYm9hcmQnXG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCdcbmltcG9ydCB7IGNhbmNlbCBhcyBjYW5jZWxEcmFnIH0gZnJvbSAnLi9kcmFnJ1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0RHJvcE1vZGUoczogU3RhdGUsIHBpZWNlPzogY2cuUGllY2UpOiB2b2lkIHtcbiAgcy5kcm9wbW9kZSA9IHtcbiAgICBhY3RpdmU6IHRydWUsXG4gICAgcGllY2VcbiAgfTtcbiAgY2FuY2VsRHJhZyhzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNhbmNlbERyb3BNb2RlKHM6IFN0YXRlKTogdm9pZCB7XG4gIHMuZHJvcG1vZGUgPSB7XG4gICAgYWN0aXZlOiBmYWxzZVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZHJvcChzOiBTdGF0ZSwgZTogY2cuTW91Y2hFdmVudCk6IHZvaWQge1xuICBpZiAoIXMuZHJvcG1vZGUuYWN0aXZlKSByZXR1cm47XG5cbiAgYm9hcmQudW5zZXRQcmVtb3ZlKHMpO1xuICBib2FyZC51bnNldFByZWRyb3Aocyk7XG5cbiAgY29uc3QgcGllY2UgPSBzLmRyb3Btb2RlLnBpZWNlO1xuXG4gIGlmIChwaWVjZSkge1xuICAgIHMucGllY2VzLmEwID0gcGllY2U7XG4gICAgY29uc3QgcG9zaXRpb24gPSB1dGlsLmV2ZW50UG9zaXRpb24oZSk7XG4gICAgY29uc3QgZGVzdCA9IHBvc2l0aW9uICYmIGJvYXJkLmdldEtleUF0RG9tUG9zKFxuICAgICAgcG9zaXRpb24sIGJvYXJkLndoaXRlUG92KHMpLCBzLmRvbS5ib3VuZHMoKSwgcy5nZW9tZXRyeSk7XG4gICAgaWYgKGRlc3QpIGJvYXJkLmRyb3BOZXdQaWVjZShzLCAnYTAnLCBkZXN0KTtcbiAgfVxuICBzLmRvbS5yZWRyYXcoKTtcbn1cbiIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcbmltcG9ydCAqIGFzIGRyYWcgZnJvbSAnLi9kcmFnJ1xuaW1wb3J0ICogYXMgZHJhdyBmcm9tICcuL2RyYXcnXG5pbXBvcnQgeyBkcm9wIH0gZnJvbSAnLi9kcm9wJ1xuaW1wb3J0IHsgaXNSaWdodEJ1dHRvbiB9IGZyb20gJy4vdXRpbCdcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXG5cbnR5cGUgTW91Y2hCaW5kID0gKGU6IGNnLk1vdWNoRXZlbnQpID0+IHZvaWQ7XG50eXBlIFN0YXRlTW91Y2hCaW5kID0gKGQ6IFN0YXRlLCBlOiBjZy5Nb3VjaEV2ZW50KSA9PiB2b2lkO1xuXG5leHBvcnQgZnVuY3Rpb24gYmluZEJvYXJkKHM6IFN0YXRlKTogdm9pZCB7XG5cbiAgaWYgKHMudmlld09ubHkpIHJldHVybjtcblxuICBjb25zdCBib2FyZEVsID0gcy5kb20uZWxlbWVudHMuYm9hcmQsXG4gIG9uU3RhcnQgPSBzdGFydERyYWdPckRyYXcocyk7XG5cbiAgLy8gQ2Fubm90IGJlIHBhc3NpdmUsIGJlY2F1c2Ugd2UgcHJldmVudCB0b3VjaCBzY3JvbGxpbmcgYW5kIGRyYWdnaW5nIG9mXG4gIC8vIHNlbGVjdGVkIGVsZW1lbnRzLlxuICBib2FyZEVsLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBvblN0YXJ0IGFzIEV2ZW50TGlzdGVuZXIsIHsgcGFzc2l2ZTogZmFsc2UgfSk7XG4gIGJvYXJkRWwuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgb25TdGFydCBhcyBFdmVudExpc3RlbmVyLCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuXG4gIGlmIChzLmRpc2FibGVDb250ZXh0TWVudSB8fCBzLmRyYXdhYmxlLmVuYWJsZWQpIHtcbiAgICBib2FyZEVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZSA9PiBlLnByZXZlbnREZWZhdWx0KCkpO1xuICB9XG59XG5cbi8vIHJldHVybnMgdGhlIHVuYmluZCBmdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmREb2N1bWVudChzOiBTdGF0ZSwgcmVkcmF3QWxsOiBjZy5SZWRyYXcpOiBjZy5VbmJpbmQge1xuXG4gIGNvbnN0IHVuYmluZHM6IGNnLlVuYmluZFtdID0gW107XG5cbiAgaWYgKCFzLmRvbS5yZWxhdGl2ZSAmJiBzLnJlc2l6YWJsZSkge1xuICAgIGNvbnN0IG9uUmVzaXplID0gKCkgPT4ge1xuICAgICAgcy5kb20uYm91bmRzLmNsZWFyKCk7XG4gICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUocmVkcmF3QWxsKTtcbiAgICB9O1xuICAgIHVuYmluZHMucHVzaCh1bmJpbmRhYmxlKGRvY3VtZW50LmJvZHksICdjaGVzc2dyb3VuZC5yZXNpemUnLCBvblJlc2l6ZSkpO1xuICB9XG5cbiAgaWYgKCFzLnZpZXdPbmx5KSB7XG5cbiAgICBjb25zdCBvbm1vdmU6IE1vdWNoQmluZCA9IGRyYWdPckRyYXcocywgZHJhZy5tb3ZlLCBkcmF3Lm1vdmUpO1xuICAgIGNvbnN0IG9uZW5kOiBNb3VjaEJpbmQgPSBkcmFnT3JEcmF3KHMsIGRyYWcuZW5kLCBkcmF3LmVuZCk7XG5cbiAgICBbJ3RvdWNobW92ZScsICdtb3VzZW1vdmUnXS5mb3JFYWNoKGV2ID0+IHVuYmluZHMucHVzaCh1bmJpbmRhYmxlKGRvY3VtZW50LCBldiwgb25tb3ZlKSkpO1xuICAgIFsndG91Y2hlbmQnLCAnbW91c2V1cCddLmZvckVhY2goZXYgPT4gdW5iaW5kcy5wdXNoKHVuYmluZGFibGUoZG9jdW1lbnQsIGV2LCBvbmVuZCkpKTtcblxuICAgIGNvbnN0IG9uU2Nyb2xsID0gKCkgPT4gcy5kb20uYm91bmRzLmNsZWFyKCk7XG4gICAgdW5iaW5kcy5wdXNoKHVuYmluZGFibGUod2luZG93LCAnc2Nyb2xsJywgb25TY3JvbGwsIHsgcGFzc2l2ZTogdHJ1ZSB9KSk7XG4gICAgdW5iaW5kcy5wdXNoKHVuYmluZGFibGUod2luZG93LCAncmVzaXplJywgb25TY3JvbGwsIHsgcGFzc2l2ZTogdHJ1ZSB9KSk7XG4gIH1cblxuICByZXR1cm4gKCkgPT4gdW5iaW5kcy5mb3JFYWNoKGYgPT4gZigpKTtcbn1cblxuZnVuY3Rpb24gdW5iaW5kYWJsZShlbDogRXZlbnRUYXJnZXQsIGV2ZW50TmFtZTogc3RyaW5nLCBjYWxsYmFjazogTW91Y2hCaW5kLCBvcHRpb25zPzogYW55KTogY2cuVW5iaW5kIHtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrIGFzIEV2ZW50TGlzdGVuZXIsIG9wdGlvbnMpO1xuICByZXR1cm4gKCkgPT4gZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrIGFzIEV2ZW50TGlzdGVuZXIpO1xufVxuXG5mdW5jdGlvbiBzdGFydERyYWdPckRyYXcoczogU3RhdGUpOiBNb3VjaEJpbmQge1xuICByZXR1cm4gZSA9PiB7XG4gICAgaWYgKHMuZHJhZ2dhYmxlLmN1cnJlbnQpIGRyYWcuY2FuY2VsKHMpO1xuICAgIGVsc2UgaWYgKHMuZHJhd2FibGUuY3VycmVudCkgZHJhdy5jYW5jZWwocyk7XG4gICAgZWxzZSBpZiAoZS5zaGlmdEtleSB8fCBpc1JpZ2h0QnV0dG9uKGUpKSB7IGlmIChzLmRyYXdhYmxlLmVuYWJsZWQpIGRyYXcuc3RhcnQocywgZSk7IH1cbiAgICBlbHNlIGlmICghcy52aWV3T25seSkge1xuICAgICAgaWYgKHMuZHJvcG1vZGUuYWN0aXZlKSBkcm9wKHMsIGUpO1xuICAgICAgZWxzZSBkcmFnLnN0YXJ0KHMsIGUpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gZHJhZ09yRHJhdyhzOiBTdGF0ZSwgd2l0aERyYWc6IFN0YXRlTW91Y2hCaW5kLCB3aXRoRHJhdzogU3RhdGVNb3VjaEJpbmQpOiBNb3VjaEJpbmQge1xuICByZXR1cm4gZSA9PiB7XG4gICAgaWYgKGUuc2hpZnRLZXkgfHwgaXNSaWdodEJ1dHRvbihlKSkgeyBpZiAocy5kcmF3YWJsZS5lbmFibGVkKSB3aXRoRHJhdyhzLCBlKTsgfVxuICAgIGVsc2UgaWYgKCFzLnZpZXdPbmx5KSB3aXRoRHJhZyhzLCBlKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcbmltcG9ydCB7IEtleSB9IGZyb20gJy4vdHlwZXMnXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGV4cGxvc2lvbihzdGF0ZTogU3RhdGUsIGtleXM6IEtleVtdKTogdm9pZCB7XG4gIHN0YXRlLmV4cGxvZGluZyA9IHsgc3RhZ2U6IDEsIGtleXMgfTtcbiAgc3RhdGUuZG9tLnJlZHJhdygpO1xuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBzZXRTdGFnZShzdGF0ZSwgMik7XG4gICAgc2V0VGltZW91dCgoKSA9PiBzZXRTdGFnZShzdGF0ZSwgdW5kZWZpbmVkKSwgMTIwKTtcbiAgfSwgMTIwKTtcbn1cblxuZnVuY3Rpb24gc2V0U3RhZ2Uoc3RhdGU6IFN0YXRlLCBzdGFnZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG4gIGlmIChzdGF0ZS5leHBsb2RpbmcpIHtcbiAgICBpZiAoc3RhZ2UpIHN0YXRlLmV4cGxvZGluZy5zdGFnZSA9IHN0YWdlO1xuICAgIGVsc2Ugc3RhdGUuZXhwbG9kaW5nID0gdW5kZWZpbmVkO1xuICAgIHN0YXRlLmRvbS5yZWRyYXcoKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgcG9zMmtleSwgTlJhbmtzLCBpbnZOUmFua3MgfSBmcm9tICcuL3V0aWwnXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xuXG5leHBvcnQgY29uc3QgaW5pdGlhbDogY2cuRkVOID0gJ3JuYnFrYm5yL3BwcHBwcHBwLzgvOC84LzgvUFBQUFBQUFAvUk5CUUtCTlInO1xuXG5jb25zdCByb2xlczg6IHsgW2xldHRlcjogc3RyaW5nXTogY2cuUm9sZSB9ID0ge1xuICAgIHA6ICdwYXduJywgcjogJ3Jvb2snLCBuOiAna25pZ2h0JywgYjogJ2Jpc2hvcCcsIHE6ICdxdWVlbicsIGs6ICdraW5nJywgbTogJ21ldCcsIGY6ICdmZXJ6JywgczogJ3NpbHZlcicsIGM6ICdjYW5jZWxsb3InLCBhOiAnYXJjaGJpc2hvcCcsIGg6ICdoYXdrJywgZTogJ2VsZXBoYW50JyB9O1xuXG5jb25zdCByb2xlczk6IHsgW2xldHRlcjogc3RyaW5nXTogY2cuUm9sZSB9ID0ge1xuICAgIHA6ICdwYXduJywgcjogJ3Jvb2snLCBuOiAna25pZ2h0JywgYjogJ2Jpc2hvcCcsIGs6ICdraW5nJywgZzogJ2dvbGQnLCBzOiAnc2lsdmVyJywgbDogJ2xhbmNlJyB9O1xuXG5jb25zdCByb2xlczEwOiB7IFtsZXR0ZXI6IHN0cmluZ106IGNnLlJvbGUgfSA9IHtcbiAgICBwOiAncGF3bicsIHI6ICdyb29rJywgbjogJ2tuaWdodCcsIGI6ICdiaXNob3AnLCBrOiAna2luZycsIGM6ICdjYW5ub24nLCBhOiAnYWR2aXNvcicgfTtcblxuXG5jb25zdCBsZXR0ZXJzOCA9IHtcbiAgICBwYXduOiAncCcsIHJvb2s6ICdyJywga25pZ2h0OiAnbicsIGJpc2hvcDogJ2InLCBxdWVlbjogJ3EnLCBraW5nOiAnaycsIG1ldDogJ20nLCBmZXJ6OiAnZicsIHNpbHZlcjogJ3MnLCBjYW5jZWxsb3I6ICdjJywgYXJjaGJpc2hvcDogJ2EnLCBoYXdrOiAnaCcsIGVsZXBoYW50OiAnZScgfTtcblxuY29uc3QgbGV0dGVyczkgPSB7XG4gICAgcGF3bjogJ3AnLCByb29rOiAncicsIGtuaWdodDogJ24nLCBiaXNob3A6ICdiJywga2luZzogJ2snLCBnb2xkOiAnZycsIHNpbHZlcjogJ3MnLCBsYW5jZTogJ2wnLFxuICAgIHBwYXduOiAnK3AnLCBwa25pZ2h0OiAnK24nLCBwYmlzaG9wOiAnK2InLCBwcm9vazogJytyJywgcHNpbHZlcjogJytzJywgcGxhbmNlOiAnK2wnIH07XG5cbmNvbnN0IGxldHRlcnMxMCA9IHtcbiAgICBwYXduOiAncCcsIHJvb2s6ICdyJywga25pZ2h0OiAnbicsIGJpc2hvcDogJ2InLCBraW5nOiAnaycsIGNhbm5vbjogJ2MnLCBhZHZpc29yOiAnYSd9O1xuXG5leHBvcnQgZnVuY3Rpb24gcmVhZChmZW46IGNnLkZFTik6IGNnLlBpZWNlcyB7XG4gIGlmIChmZW4gPT09ICdzdGFydCcpIGZlbiA9IGluaXRpYWw7XG4gIGlmIChmZW4uaW5kZXhPZignWycpICE9PSAtMSkgZmVuID0gZmVuLnNsaWNlKDAsIGZlbi5pbmRleE9mKCdbJykpO1xuICBjb25zdCBwaWVjZXM6IGNnLlBpZWNlcyA9IHt9O1xuICBsZXQgcm93OiBudW1iZXIgPSBmZW4uc3BsaXQoXCIvXCIpLmxlbmd0aDtcbiAgbGV0IGNvbDogbnVtYmVyID0gMDtcbiAgbGV0IHByb21vdGVkOiBib29sZWFuID0gZmFsc2U7XG4gIGNvbnN0IHJvbGVzID0gcm93ID09PSAxMCA/IHJvbGVzMTAgOiByb3cgPT09IDkgPyByb2xlczkgOiByb2xlczg7XG4gIGNvbnN0IGZpcnN0UmFua0lzMCA9IHJvdyA9PT0gMTA7XG4gIGNvbnN0IHNob2dpID0gcm93ID09PSA5O1xuICBmb3IgKGNvbnN0IGMgb2YgZmVuKSB7XG4gICAgc3dpdGNoIChjKSB7XG4gICAgICBjYXNlICcgJzogcmV0dXJuIHBpZWNlcztcbiAgICAgIGNhc2UgJy8nOlxuICAgICAgICAtLXJvdztcbiAgICAgICAgaWYgKHJvdyA9PT0gMCkgcmV0dXJuIHBpZWNlcztcbiAgICAgICAgY29sID0gMDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcrJzpcbiAgICAgICAgcHJvbW90ZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ34nOlxuICAgICAgICBjb25zdCBwaWVjZSA9IHBpZWNlc1tjZy5maWxlc1tjb2xdICsgY2cucmFua3NbZmlyc3RSYW5rSXMwID8gcm93IDogcm93ICsgMV1dO1xuICAgICAgICBpZiAocGllY2UpIHBpZWNlLnByb21vdGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBjb25zdCBuYiA9IGMuY2hhckNvZGVBdCgwKTtcbiAgICAgICAgaWYgKG5iIDwgNTgpIGNvbCArPSAoYyA9PT0gJzAnKSA/IDkgOiBuYiAtIDQ4O1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICArK2NvbDtcbiAgICAgICAgICBjb25zdCByb2xlID0gYy50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIGxldCBwaWVjZSA9IHtcbiAgICAgICAgICAgIHJvbGU6IHJvbGVzW3JvbGVdLFxuICAgICAgICAgICAgY29sb3I6IChjID09PSByb2xlID8gc2hvZ2kgPyAnd2hpdGUnOiAnYmxhY2snIDogc2hvZ2kgPyAnYmxhY2snIDogJ3doaXRlJykgYXMgY2cuQ29sb3JcbiAgICAgICAgICB9IGFzIGNnLlBpZWNlO1xuICAgICAgICAgIGlmIChwcm9tb3RlZCkge1xuICAgICAgICAgICAgcGllY2Uucm9sZSA9ICdwJyArIHBpZWNlLnJvbGUgYXMgY2cuUm9sZTtcbiAgICAgICAgICAgIHBpZWNlLnByb21vdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHByb21vdGVkID0gZmFsc2U7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBpZiAoc2hvZ2kpIHtcbiAgICAgICAgICAgICAgcGllY2VzW2NnLmZpbGVzWzEwIC0gY29sIC0gMV0gKyBjZy5yYW5rc1sxMCAtIHJvd11dID0gcGllY2U7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGllY2VzW2NnLmZpbGVzW2NvbCAtIDFdICsgY2cucmFua3NbZmlyc3RSYW5rSXMwID8gcm93IC0gMSA6IHJvd11dID0gcGllY2U7XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcGllY2VzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGUocGllY2VzOiBjZy5QaWVjZXMsIGdlb206IGNnLkdlb21ldHJ5KTogY2cuRkVOIHtcbiAgY29uc3QgaGVpZ2h0OiBudW1iZXIgPSBjZy5kaW1lbnNpb25zW2dlb21dLmhlaWdodDtcbiAgdmFyIGxldHRlcnM6IGFueSA9IHt9O1xuICBzd2l0Y2ggKGhlaWdodCkge1xuICBjYXNlIDEwOlxuICAgIGxldHRlcnMgPSBsZXR0ZXJzMTA7XG4gICAgYnJlYWs7XG4gIGNhc2UgOTpcbiAgICBsZXR0ZXJzID0gbGV0dGVyczk7XG4gICAgYnJlYWs7XG4gIGRlZmF1bHQ6XG4gICAgbGV0dGVycyA9IGxldHRlcnM4O1xuICAgIGJyZWFrXG4gIH07XG4gIHJldHVybiBpbnZOUmFua3MubWFwKHkgPT4gTlJhbmtzLm1hcCh4ID0+IHtcbiAgICAgIGNvbnN0IHBpZWNlID0gcGllY2VzW3BvczJrZXkoW3gsIHldLCBnZW9tKV07XG4gICAgICBpZiAocGllY2UpIHtcbiAgICAgICAgY29uc3QgbGV0dGVyOiBzdHJpbmcgPSBsZXR0ZXJzW3BpZWNlLnJvbGVdO1xuICAgICAgICByZXR1cm4gcGllY2UuY29sb3IgPT09ICd3aGl0ZScgPyBsZXR0ZXIudG9VcHBlckNhc2UoKSA6IGxldHRlcjtcbiAgICAgIH0gZWxzZSByZXR1cm4gJzEnO1xuICAgIH0pLmpvaW4oJycpXG4gICkuam9pbignLycpLnJlcGxhY2UoLzF7Mix9L2csIHMgPT4gcy5sZW5ndGgudG9TdHJpbmcoKSk7XG59XG4iLCJpbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCdcbmltcG9ydCAqIGFzIGNnIGZyb20gJy4vdHlwZXMnXG5cbnR5cGUgTW9iaWxpdHkgPSAoeDE6bnVtYmVyLCB5MTpudW1iZXIsIHgyOm51bWJlciwgeTI6bnVtYmVyKSA9PiBib29sZWFuO1xuXG5mdW5jdGlvbiBkaWZmKGE6IG51bWJlciwgYjpudW1iZXIpOm51bWJlciB7XG4gIHJldHVybiBNYXRoLmFicyhhIC0gYik7XG59XG5cbmZ1bmN0aW9uIHBhd24oY29sb3I6IGNnLkNvbG9yKTogTW9iaWxpdHkge1xuICByZXR1cm4gKHgxLCB5MSwgeDIsIHkyKSA9PiBkaWZmKHgxLCB4MikgPCAyICYmIChcbiAgICBjb2xvciA9PT0gJ3doaXRlJyA/IChcbiAgICAgIC8vIGFsbG93IDIgc3F1YXJlcyBmcm9tIDEgYW5kIDgsIGZvciBob3JkZVxuICAgICAgeTIgPT09IHkxICsgMSB8fCAoeTEgPD0gMiAmJiB5MiA9PT0gKHkxICsgMikgJiYgeDEgPT09IHgyKVxuICAgICkgOiAoXG4gICAgICB5MiA9PT0geTEgLSAxIHx8ICh5MSA+PSA3ICYmIHkyID09PSAoeTEgLSAyKSAmJiB4MSA9PT0geDIpXG4gICAgKVxuICApO1xufVxuXG5jb25zdCBrbmlnaHQ6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIGNvbnN0IHhkID0gZGlmZih4MSwgeDIpO1xuICBjb25zdCB5ZCA9IGRpZmYoeTEsIHkyKTtcbiAgcmV0dXJuICh4ZCA9PT0gMSAmJiB5ZCA9PT0gMikgfHwgKHhkID09PSAyICYmIHlkID09PSAxKTtcbn1cblxuY29uc3QgYmlzaG9wOiBNb2JpbGl0eSA9ICh4MSwgeTEsIHgyLCB5MikgPT4ge1xuICByZXR1cm4gZGlmZih4MSwgeDIpID09PSBkaWZmKHkxLCB5Mik7XG59XG5cbmNvbnN0IHJvb2s6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIHJldHVybiB4MSA9PT0geDIgfHwgeTEgPT09IHkyO1xufVxuXG5jb25zdCBxdWVlbjogTW9iaWxpdHkgPSAoeDEsIHkxLCB4MiwgeTIpID0+IHtcbiAgcmV0dXJuIGJpc2hvcCh4MSwgeTEsIHgyLCB5MikgfHwgcm9vayh4MSwgeTEsIHgyLCB5Mik7XG59XG5cbmZ1bmN0aW9uIGtpbmcoY29sb3I6IGNnLkNvbG9yLCByb29rRmlsZXM6IG51bWJlcltdLCBjYW5DYXN0bGU6IGJvb2xlYW4pOiBNb2JpbGl0eSB7XG4gIHJldHVybiAoeDEsIHkxLCB4MiwgeTIpICA9PiAoXG4gICAgZGlmZih4MSwgeDIpIDwgMiAmJiBkaWZmKHkxLCB5MikgPCAyXG4gICkgfHwgKFxuICAgIGNhbkNhc3RsZSAmJiB5MSA9PT0geTIgJiYgeTEgPT09IChjb2xvciA9PT0gJ3doaXRlJyA/IDEgOiA4KSAmJiAoXG4gICAgICAoeDEgPT09IDUgJiYgKHgyID09PSAzIHx8IHgyID09PSA3KSkgfHwgdXRpbC5jb250YWluc1gocm9va0ZpbGVzLCB4MilcbiAgICApXG4gICk7XG59XG5cbi8vIG1ha3J1ay9zaXR0dXlpbiBxdWVlblxuY29uc3QgbWV0OiBNb2JpbGl0eSA9ICh4MSwgeTEsIHgyLCB5MikgPT4ge1xuICByZXR1cm4gZGlmZih4MSwgeDIpID09PSBkaWZmKHkxLCB5MikgJiYgZGlmZih4MSwgeDIpID09PSAxO1xufVxuXG4vLyBjYXBhYmxhbmNhIGFyY2hiaXNob3AsIHNlaXJhd2FuIGhhd2tcbmNvbnN0IGFyY2hiaXNob3A6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIHJldHVybiBiaXNob3AoeDEsIHkxLCB4MiwgeTIpIHx8IGtuaWdodCh4MSwgeTEsIHgyLCB5Mik7XG59XG5cbi8vIGNhcGFibGFuY2EgY2FuY2VsbG9yLCBzZWlyYXdhbiBlbGVwaGFudFxuY29uc3QgY2FuY2VsbG9yOiBNb2JpbGl0eSA9ICh4MSwgeTEsIHgyLCB5MikgPT4ge1xuICByZXR1cm4gcm9vayh4MSwgeTEsIHgyLCB5MikgfHwga25pZ2h0KHgxLCB5MSwgeDIsIHkyKTtcbn1cblxuLy8gc2hvZ2kgbGFuY2VcbmZ1bmN0aW9uIGxhbmNlKGNvbG9yOiBjZy5Db2xvcik6IE1vYmlsaXR5IHtcbiAgcmV0dXJuICh4MSwgeTEsIHgyLCB5MikgPT4gKFxuICAgIHgyID09PSB4MSAmJiAoY29sb3IgPT09ICd3aGl0ZScgPyB5MiA+IHkxIDogeTIgPCB5MSlcbiAgKTtcbn1cblxuLy8gc2hvZ2kgc2lsdmVyLCBtYWtydWsvc2l0dHV5aW4gYmlzaG9wXG5mdW5jdGlvbiBzaWx2ZXIoY29sb3I6IGNnLkNvbG9yKTogTW9iaWxpdHkge1xuICByZXR1cm4gKHgxLCB5MSwgeDIsIHkyKSAgPT4gKFxuICAgIG1ldCh4MSwgeTEsIHgyLCB5MikgfHwgKHgxID09PSB4MiAmJiAoY29sb3IgPT09ICd3aGl0ZScgPyB5MiA9PT0geTEgKyAxIDogeTIgPT09IHkxIC0gMSkpXG4gICk7XG59XG5cbi8vIHNob2dpIGdvbGQsIHByb21vdGVkIHBhd24va25pZ2h0L2xhbmNlL3NpbHZlclxuZnVuY3Rpb24gZ29sZChjb2xvcjogY2cuQ29sb3IpOiBNb2JpbGl0eSB7XG4gIHJldHVybiAoeDEsIHkxLCB4MiwgeTIpICA9PiAoXG4gICAgZGlmZih4MSwgeDIpIDwgMiAmJiBkaWZmKHkxLCB5MikgPCAyICYmIChcbiAgICAgIGNvbG9yID09PSAnd2hpdGUnID9cbiAgICAgICAgISgoeDIgPT09IHgxIC0gMSAmJiB5MiA9PT0geTEgLSAxKSB8fCAoeDIgPT09IHgxICsgMSAmJiB5MiA9PT0geTEgLSAxKSkgOlxuICAgICAgICAhKCh4MiA9PT0geDEgKyAxICYmIHkyID09PSB5MSArIDEpIHx8ICh4MiA9PT0geDEgLSAxICYmIHkyID09PSB5MSArIDEpKVxuICAgIClcbiAgKTtcbn1cblxuLy8gc2hvZ2kgcGF3blxuZnVuY3Rpb24gc3Bhd24oY29sb3I6IGNnLkNvbG9yKTogTW9iaWxpdHkge1xuICByZXR1cm4gKHgxLCB5MSwgeDIsIHkyKSA9PiAoeDIgPT09IHgxICYmIChjb2xvciA9PT0gJ3doaXRlJyA/IHkyID09PSB5MSArIDEgOiB5MiA9PT0geTEgLSAxKSk7XG59XG5cbi8vIHNob2dpIGtuaWdodFxuZnVuY3Rpb24gc2tuaWdodChjb2xvcjogY2cuQ29sb3IpOiBNb2JpbGl0eSB7XG4gIHJldHVybiAoeDEsIHkxLCB4MiwgeTIpID0+IGNvbG9yID09PSAnd2hpdGUnID9cbiAgICAoeTIgPT09IHkxICsgMiAmJiB4MiA9PT0geDEgLSAxIHx8IHkyID09PSB5MSArIDIgJiYgeDIgPT09IHgxICsgMSkgOlxuICAgICh5MiA9PT0geTEgLSAyICYmIHgyID09PSB4MSAtIDEgfHwgeTIgPT09IHkxIC0gMiAmJiB4MiA9PT0geDEgKyAxKTtcbn1cblxuLy8gc2hvZ2kgcHJvbW90ZWQgcm9va1xuY29uc3QgcHJvb2s6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIHJldHVybiByb29rKHgxLCB5MSwgeDIsIHkyKSB8fCAoZGlmZih4MSwgeDIpIDwgMiAmJiBkaWZmKHkxLCB5MikgPCAyKTtcbn1cblxuLy8gc2hvZ2kgcHJvbW90ZWQgYmlzaG9wXG5jb25zdCBwYmlzaG9wOiBNb2JpbGl0eSA9ICh4MSwgeTEsIHgyLCB5MikgPT4ge1xuICByZXR1cm4gYmlzaG9wKHgxLCB5MSwgeDIsIHkyKSB8fCAoZGlmZih4MSwgeDIpIDwgMiAmJiBkaWZmKHkxLCB5MikgPCAyKTtcbn1cblxuLy8gc2hvZ2kga2luZ1xuY29uc3Qgc2tpbmc6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIHJldHVybiBkaWZmKHgxLCB4MikgPCAyICYmIGRpZmYoeTEsIHkyKSA8IDI7XG59XG5cbi8vIHhpYW5ncWkgcGF3blxuZnVuY3Rpb24geHBhd24oY29sb3I6IGNnLkNvbG9yKTogTW9iaWxpdHkge1xuICByZXR1cm4gKHgxLCB5MSwgeDIsIHkyKSA9PiAoXG4gICAgKHgyID09PSB4MSAmJiAoY29sb3IgPT09ICd3aGl0ZScgPyB5MiA9PT0geTEgKyAxIDogeTIgPT09IHkxIC0gMSkpIHx8XG4gICAgKHkyID09PSB5MSAmJiAoeDIgPT09IHgxICsgMSB8fCB4MiA9PT0geDEgLSAxKSAmJiAoY29sb3IgPT09ICd3aGl0ZScgPyB5MSA+IDU6IHkxIDwgNikpXG4gICAgKTtcbn1cblxuLy8geGlhbmdxaSBiaXNob3BcbmNvbnN0IHhiaXNob3A6IE1vYmlsaXR5ID0gKHgxLCB5MSwgeDIsIHkyKSA9PiB7XG4gIHJldHVybiBkaWZmKHgxLCB4MikgPT09IGRpZmYoeTEsIHkyKSAmJiBkaWZmKHgxLCB4MikgPT09IDI7XG59XG5cbi8vIHhpYW5ncWkgYWR2aXNvclxuY29uc3QgYWR2aXNvcjogTW9iaWxpdHkgPSAoeDEsIHkxLCB4MiwgeTIpID0+IHtcbiAgcmV0dXJuIGRpZmYoeDEsIHgyKSA9PT0gZGlmZih5MSwgeTIpICYmIGRpZmYoeDEsIHgyKSA9PT0gMTtcbn1cblxuLy8geGlhbmdxaSBnZW5lcmFsKGtpbmcpXG5jb25zdCB4a2luZzogTW9iaWxpdHkgPSAoeDEsIHkxLCB4MiwgeTIpID0+IHtcbiAgLy8gVE9ETzogZmx5aW5nIGdlbmVyYWwgY2FuIGNhcHR1cmUgb3BwIGdlbmVyYWxcbiAgcmV0dXJuICh4MSA9PT0geDIgfHwgeTEgPT09IHkyKSAmJiBkaWZmKHgxLCB4MikgPT09IDE7XG59XG5cbmZ1bmN0aW9uIHJvb2tGaWxlc09mKHBpZWNlczogY2cuUGllY2VzLCBjb2xvcjogY2cuQ29sb3IsIGZpcnN0UmFua0lzMDogYm9vbGVhbikge1xuICByZXR1cm4gT2JqZWN0LmtleXMocGllY2VzKS5maWx0ZXIoa2V5ID0+IHtcbiAgICBjb25zdCBwaWVjZSA9IHBpZWNlc1trZXldO1xuICAgIHJldHVybiBwaWVjZSAmJiBwaWVjZS5jb2xvciA9PT0gY29sb3IgJiYgcGllY2Uucm9sZSA9PT0gJ3Jvb2snO1xuICB9KS5tYXAoKGtleTogc3RyaW5nICkgPT4gdXRpbC5rZXkycG9zKGtleSBhcyBjZy5LZXksIGZpcnN0UmFua0lzMClbMF0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwcmVtb3ZlKHBpZWNlczogY2cuUGllY2VzLCBrZXk6IGNnLktleSwgY2FuQ2FzdGxlOiBib29sZWFuLCBnZW9tOiBjZy5HZW9tZXRyeSk6IGNnLktleVtdIHtcbiAgY29uc3QgZmlyc3RSYW5rSXMwID0gY2cuZGltZW5zaW9uc1tnZW9tXS5oZWlnaHQgPT09IDEwO1xuICBjb25zdCBwaWVjZSA9IHBpZWNlc1trZXldISxcbiAgcG9zID0gdXRpbC5rZXkycG9zKGtleSwgZmlyc3RSYW5rSXMwKTtcbiAgbGV0IG1vYmlsaXR5OiBNb2JpbGl0eTtcbiAgLy8gUGllY2UgcHJlbW92ZSBkZXBlbmRzIG9uIGNoZXNzIHZhcmlhbnQgbm90IG9uIGJvYXJkIGdlb21ldHJ5LCBidXQgd2Ugd2lsbCB1c2UgaXQgaGVyZVxuICAvLyBGLmUuIHNob2dpIGlzIG5vdCB0aGUgb25seSA5eDkgdmFyaWFudCwgc2VlIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0plc29uX01vclxuICBzd2l0Y2ggKGdlb20pIHtcbiAgY2FzZSBjZy5HZW9tZXRyeS5kaW05eDEwOlxuICAgIHN3aXRjaCAocGllY2Uucm9sZSkge1xuICAgIGNhc2UgJ3Bhd24nOlxuICAgICAgbW9iaWxpdHkgPSB4cGF3bihwaWVjZS5jb2xvcik7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdjYW5ub24nOlxuICAgIGNhc2UgJ3Jvb2snOlxuICAgICAgbW9iaWxpdHkgPSByb29rO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAna25pZ2h0JzpcbiAgICAgIG1vYmlsaXR5ID0ga25pZ2h0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnYmlzaG9wJzpcbiAgICAgIG1vYmlsaXR5ID0geGJpc2hvcDtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Fkdmlzb3InOlxuICAgICAgbW9iaWxpdHkgPSBhZHZpc29yO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAna2luZyc6XG4gICAgICBtb2JpbGl0eSA9IHhraW5nO1xuICAgICAgYnJlYWs7XG4gICAgfTtcbiAgICBicmVhaztcbiAgY2FzZSBjZy5HZW9tZXRyeS5kaW05eDk6XG4gICAgc3dpdGNoIChwaWVjZS5yb2xlKSB7XG4gICAgY2FzZSAncGF3bic6XG4gICAgICBtb2JpbGl0eSA9IHNwYXduKHBpZWNlLmNvbG9yKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2tuaWdodCc6XG4gICAgICBtb2JpbGl0eSA9IHNrbmlnaHQocGllY2UuY29sb3IpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnYmlzaG9wJzpcbiAgICAgIG1vYmlsaXR5ID0gYmlzaG9wO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncm9vayc6XG4gICAgICBtb2JpbGl0eSA9IHJvb2s7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdraW5nJzpcbiAgICAgIG1vYmlsaXR5ID0gc2tpbmc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdzaWx2ZXInOlxuICAgICAgbW9iaWxpdHkgPSBzaWx2ZXIocGllY2UuY29sb3IpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncHBhd24nOlxuICAgIGNhc2UgJ3BsYW5jZSc6XG4gICAgY2FzZSAncGtuaWdodCc6XG4gICAgY2FzZSAncHNpbHZlcic6XG4gICAgY2FzZSAnZ29sZCc6XG4gICAgICBtb2JpbGl0eSA9IGdvbGQocGllY2UuY29sb3IpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnbGFuY2UnOlxuICAgICAgbW9iaWxpdHkgPSBsYW5jZShwaWVjZS5jb2xvcik7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdwcm9vayc6XG4gICAgICBtb2JpbGl0eSA9IHByb29rO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncGJpc2hvcCc6XG4gICAgICBtb2JpbGl0eSA9IHBiaXNob3A7XG4gICAgICBicmVhaztcbiAgICB9O1xuICAgIGJyZWFrO1xuICBkZWZhdWx0OlxuICAgIHN3aXRjaCAocGllY2Uucm9sZSkge1xuICAgIGNhc2UgJ3Bhd24nOlxuICAgICAgbW9iaWxpdHkgPSBwYXduKHBpZWNlLmNvbG9yKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2tuaWdodCc6XG4gICAgICBtb2JpbGl0eSA9IGtuaWdodDtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Jpc2hvcCc6XG4gICAgICBtb2JpbGl0eSA9IGJpc2hvcDtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3Jvb2snOlxuICAgICAgbW9iaWxpdHkgPSByb29rO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncXVlZW4nOlxuICAgICAgbW9iaWxpdHkgPSBxdWVlbjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2tpbmcnOlxuICAgICAgbW9iaWxpdHkgPSBraW5nKHBpZWNlLmNvbG9yLCByb29rRmlsZXNPZihwaWVjZXMsIHBpZWNlLmNvbG9yLCBmaXJzdFJhbmtJczApLCBjYW5DYXN0bGUpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnaGF3ayc6XG4gICAgY2FzZSAnYXJjaGJpc2hvcCc6XG4gICAgICBtb2JpbGl0eSA9IGFyY2hiaXNob3A7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdlbGVwaGFudCc6XG4gICAgY2FzZSAnY2FuY2VsbG9yJzpcbiAgICAgIG1vYmlsaXR5ID0gY2FuY2VsbG9yO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnbWV0JzpcbiAgICBjYXNlICdmZXJ6JzpcbiAgICAgIG1vYmlsaXR5ID0gbWV0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnc2lsdmVyJzpcbiAgICAgIG1vYmlsaXR5ID0gc2lsdmVyKHBpZWNlLmNvbG9yKTtcbiAgICAgIGJyZWFrO1xuICAgIH07XG4gICAgYnJlYWs7XG4gIH07XG4gIGNvbnN0IGFsbGtleXMgPSB1dGlsLmFsbEtleXNbZ2VvbV07XG5cbiAgY29uc3QgcG9zMmtleUdlb20gPSAoZ2VvbTogY2cuR2VvbWV0cnkpID0+ICggKHBvczogY2cuUG9zKSA9PiB1dGlsLnBvczJrZXkocG9zLCBnZW9tKSApO1xuICBjb25zdCBwb3Mya2V5ID0gcG9zMmtleUdlb20oZ2VvbSk7XG5cbiAgY29uc3Qga2V5MnBvc1JhbmswID0gKGZpcnN0cmFuazA6IGJvb2xlYW4pID0+ICggKGtleTogY2cuS2V5KSA9PiB1dGlsLmtleTJwb3Moa2V5LCBmaXJzdHJhbmswKSApO1xuICBjb25zdCBrZXkycG9zID0ga2V5MnBvc1JhbmswKGZpcnN0UmFua0lzMCk7XG5cbiAgcmV0dXJuIGFsbGtleXMubWFwKGtleTJwb3MpLmZpbHRlcihwb3MyID0+IHtcbiAgICByZXR1cm4gKHBvc1swXSAhPT0gcG9zMlswXSB8fCBwb3NbMV0gIT09IHBvczJbMV0pICYmIG1vYmlsaXR5KHBvc1swXSwgcG9zWzFdLCBwb3MyWzBdLCBwb3MyWzFdKTtcbiAgfSkubWFwKHBvczJrZXkpO1xufTtcbiIsImltcG9ydCB7IFN0YXRlIH0gZnJvbSAnLi9zdGF0ZSdcbmltcG9ydCB7IGtleTJwb3MsIGNyZWF0ZUVsIH0gZnJvbSAnLi91dGlsJ1xuaW1wb3J0IHsgd2hpdGVQb3YgfSBmcm9tICcuL2JvYXJkJ1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnXG5pbXBvcnQgeyBBbmltQ3VycmVudCwgQW5pbVZlY3RvcnMsIEFuaW1WZWN0b3IsIEFuaW1GYWRpbmdzIH0gZnJvbSAnLi9hbmltJ1xuaW1wb3J0IHsgRHJhZ0N1cnJlbnQgfSBmcm9tICcuL2RyYWcnXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJ1xuXG4vLyBgJGNvbG9yICRyb2xlYFxudHlwZSBQaWVjZU5hbWUgPSBzdHJpbmc7XG5cbmludGVyZmFjZSBTYW1lUGllY2VzIHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9XG5pbnRlcmZhY2UgU2FtZVNxdWFyZXMgeyBba2V5OiBzdHJpbmddOiBib29sZWFuIH1cbmludGVyZmFjZSBNb3ZlZFBpZWNlcyB7IFtwaWVjZU5hbWU6IHN0cmluZ106IGNnLlBpZWNlTm9kZVtdIH1cbmludGVyZmFjZSBNb3ZlZFNxdWFyZXMgeyBbY2xhc3NOYW1lOiBzdHJpbmddOiBjZy5TcXVhcmVOb2RlW10gfVxuaW50ZXJmYWNlIFNxdWFyZUNsYXNzZXMgeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfVxuXG4vLyBwb3J0ZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vdmVsb2NlL2xpY2hvYmlsZS9ibG9iL21hc3Rlci9zcmMvanMvY2hlc3Nncm91bmQvdmlldy5qc1xuLy8gaW4gY2FzZSBvZiBidWdzLCBibGFtZSBAdmVsb2NlXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZW5kZXIoczogU3RhdGUpOiB2b2lkIHtcbiAgY29uc3QgZmlyc3RSYW5rSXMwID0gcy5kaW1lbnNpb25zLmhlaWdodCA9PT0gMTA7XG4gIGNvbnN0IGFzV2hpdGU6IGJvb2xlYW4gPSB3aGl0ZVBvdihzKSxcbiAgcG9zVG9UcmFuc2xhdGUgPSBzLmRvbS5yZWxhdGl2ZSA/IHV0aWwucG9zVG9UcmFuc2xhdGVSZWwgOiB1dGlsLnBvc1RvVHJhbnNsYXRlQWJzKHMuZG9tLmJvdW5kcygpLCBzLmRpbWVuc2lvbnMpLFxuICB0cmFuc2xhdGUgPSBzLmRvbS5yZWxhdGl2ZSA/IHV0aWwudHJhbnNsYXRlUmVsIDogdXRpbC50cmFuc2xhdGVBYnMsXG4gIGJvYXJkRWw6IEhUTUxFbGVtZW50ID0gcy5kb20uZWxlbWVudHMuYm9hcmQsXG4gIHBpZWNlczogY2cuUGllY2VzID0gcy5waWVjZXMsXG4gIGN1ckFuaW06IEFuaW1DdXJyZW50IHwgdW5kZWZpbmVkID0gcy5hbmltYXRpb24uY3VycmVudCxcbiAgYW5pbXM6IEFuaW1WZWN0b3JzID0gY3VyQW5pbSA/IGN1ckFuaW0ucGxhbi5hbmltcyA6IHt9LFxuICBmYWRpbmdzOiBBbmltRmFkaW5ncyA9IGN1ckFuaW0gPyBjdXJBbmltLnBsYW4uZmFkaW5ncyA6IHt9LFxuICBjdXJEcmFnOiBEcmFnQ3VycmVudCB8IHVuZGVmaW5lZCA9IHMuZHJhZ2dhYmxlLmN1cnJlbnQsXG4gIHNxdWFyZXM6IFNxdWFyZUNsYXNzZXMgPSBjb21wdXRlU3F1YXJlQ2xhc3NlcyhzKSxcbiAgc2FtZVBpZWNlczogU2FtZVBpZWNlcyA9IHt9LFxuICBzYW1lU3F1YXJlczogU2FtZVNxdWFyZXMgPSB7fSxcbiAgbW92ZWRQaWVjZXM6IE1vdmVkUGllY2VzID0ge30sXG4gIG1vdmVkU3F1YXJlczogTW92ZWRTcXVhcmVzID0ge30sXG4gIHBpZWNlc0tleXM6IGNnLktleVtdID0gT2JqZWN0LmtleXMocGllY2VzKSBhcyBjZy5LZXlbXTtcbiAgbGV0IGs6IGNnLktleSxcbiAgcDogY2cuUGllY2UgfCB1bmRlZmluZWQsXG4gIGVsOiBjZy5QaWVjZU5vZGUgfCBjZy5TcXVhcmVOb2RlLFxuICBwaWVjZUF0S2V5OiBjZy5QaWVjZSB8IHVuZGVmaW5lZCxcbiAgZWxQaWVjZU5hbWU6IFBpZWNlTmFtZSxcbiAgYW5pbTogQW5pbVZlY3RvciB8IHVuZGVmaW5lZCxcbiAgZmFkaW5nOiBjZy5QaWVjZSB8IHVuZGVmaW5lZCxcbiAgcE12ZHNldDogY2cuUGllY2VOb2RlW10sXG4gIHBNdmQ6IGNnLlBpZWNlTm9kZSB8IHVuZGVmaW5lZCxcbiAgc012ZHNldDogY2cuU3F1YXJlTm9kZVtdLFxuICBzTXZkOiBjZy5TcXVhcmVOb2RlIHwgdW5kZWZpbmVkO1xuXG4gIC8vIHdhbGsgb3ZlciBhbGwgYm9hcmQgZG9tIGVsZW1lbnRzLCBhcHBseSBhbmltYXRpb25zIGFuZCBmbGFnIG1vdmVkIHBpZWNlc1xuICBlbCA9IGJvYXJkRWwuZmlyc3RDaGlsZCBhcyBjZy5QaWVjZU5vZGUgfCBjZy5TcXVhcmVOb2RlO1xuICB3aGlsZSAoZWwpIHtcbiAgICBrID0gZWwuY2dLZXk7XG4gICAgaWYgKGlzUGllY2VOb2RlKGVsKSkge1xuICAgICAgcGllY2VBdEtleSA9IHBpZWNlc1trXTtcbiAgICAgIGFuaW0gPSBhbmltc1trXTtcbiAgICAgIGZhZGluZyA9IGZhZGluZ3Nba107XG4gICAgICBlbFBpZWNlTmFtZSA9IGVsLmNnUGllY2U7XG4gICAgICAvLyBpZiBwaWVjZSBub3QgYmVpbmcgZHJhZ2dlZCBhbnltb3JlLCByZW1vdmUgZHJhZ2dpbmcgc3R5bGVcbiAgICAgIGlmIChlbC5jZ0RyYWdnaW5nICYmICghY3VyRHJhZyB8fCBjdXJEcmFnLm9yaWcgIT09IGspKSB7XG4gICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWdnaW5nJyk7XG4gICAgICAgIHRyYW5zbGF0ZShlbCwgcG9zVG9UcmFuc2xhdGUoa2V5MnBvcyhrLCBmaXJzdFJhbmtJczApLCBhc1doaXRlLCBzLmRpbWVuc2lvbnMpKTtcbiAgICAgICAgZWwuY2dEcmFnZ2luZyA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgLy8gcmVtb3ZlIGZhZGluZyBjbGFzcyBpZiBpdCBzdGlsbCByZW1haW5zXG4gICAgICBpZiAoIWZhZGluZyAmJiBlbC5jZ0ZhZGluZykge1xuICAgICAgICBlbC5jZ0ZhZGluZyA9IGZhbHNlO1xuICAgICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdmYWRpbmcnKTtcbiAgICAgIH1cbiAgICAgIC8vIHRoZXJlIGlzIG5vdyBhIHBpZWNlIGF0IHRoaXMgZG9tIGtleVxuICAgICAgaWYgKHBpZWNlQXRLZXkpIHtcbiAgICAgICAgLy8gY29udGludWUgYW5pbWF0aW9uIGlmIGFscmVhZHkgYW5pbWF0aW5nIGFuZCBzYW1lIHBpZWNlXG4gICAgICAgIC8vIChvdGhlcndpc2UgaXQgY291bGQgYW5pbWF0ZSBhIGNhcHR1cmVkIHBpZWNlKVxuICAgICAgICBpZiAoYW5pbSAmJiBlbC5jZ0FuaW1hdGluZyAmJiBlbFBpZWNlTmFtZSA9PT0gcGllY2VOYW1lT2YocGllY2VBdEtleSkpIHtcbiAgICAgICAgICBjb25zdCBwb3MgPSBrZXkycG9zKGssIGZpcnN0UmFua0lzMCk7XG4gICAgICAgICAgcG9zWzBdICs9IGFuaW1bMl07XG4gICAgICAgICAgcG9zWzFdICs9IGFuaW1bM107XG4gICAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnYW5pbScpO1xuICAgICAgICAgIHRyYW5zbGF0ZShlbCwgcG9zVG9UcmFuc2xhdGUocG9zLCBhc1doaXRlLCBzLmRpbWVuc2lvbnMpKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbC5jZ0FuaW1hdGluZykge1xuICAgICAgICAgIGVsLmNnQW5pbWF0aW5nID0gZmFsc2U7XG4gICAgICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnYW5pbScpO1xuICAgICAgICAgIHRyYW5zbGF0ZShlbCwgcG9zVG9UcmFuc2xhdGUoa2V5MnBvcyhrLCBmaXJzdFJhbmtJczApLCBhc1doaXRlLCBzLmRpbWVuc2lvbnMpKTtcbiAgICAgICAgICBpZiAocy5hZGRQaWVjZVpJbmRleCkgZWwuc3R5bGUuekluZGV4ID0gcG9zWkluZGV4KGtleTJwb3MoaywgZmlyc3RSYW5rSXMwKSwgYXNXaGl0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2FtZSBwaWVjZTogZmxhZyBhcyBzYW1lXG4gICAgICAgIGlmIChlbFBpZWNlTmFtZSA9PT0gcGllY2VOYW1lT2YocGllY2VBdEtleSkgJiYgKCFmYWRpbmcgfHwgIWVsLmNnRmFkaW5nKSkge1xuICAgICAgICAgIHNhbWVQaWVjZXNba10gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRpZmZlcmVudCBwaWVjZTogZmxhZyBhcyBtb3ZlZCB1bmxlc3MgaXQgaXMgYSBmYWRpbmcgcGllY2VcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaWYgKGZhZGluZyAmJiBlbFBpZWNlTmFtZSA9PT0gcGllY2VOYW1lT2YoZmFkaW5nKSkge1xuICAgICAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnZmFkaW5nJyk7XG4gICAgICAgICAgICBlbC5jZ0ZhZGluZyA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChtb3ZlZFBpZWNlc1tlbFBpZWNlTmFtZV0pIG1vdmVkUGllY2VzW2VsUGllY2VOYW1lXS5wdXNoKGVsKTtcbiAgICAgICAgICAgIGVsc2UgbW92ZWRQaWVjZXNbZWxQaWVjZU5hbWVdID0gW2VsXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIG5vIHBpZWNlOiBmbGFnIGFzIG1vdmVkXG4gICAgICBlbHNlIHtcbiAgICAgICAgaWYgKG1vdmVkUGllY2VzW2VsUGllY2VOYW1lXSkgbW92ZWRQaWVjZXNbZWxQaWVjZU5hbWVdLnB1c2goZWwpO1xuICAgICAgICBlbHNlIG1vdmVkUGllY2VzW2VsUGllY2VOYW1lXSA9IFtlbF07XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzU3F1YXJlTm9kZShlbCkpIHtcbiAgICAgIGNvbnN0IGNuID0gZWwuY2xhc3NOYW1lO1xuICAgICAgaWYgKHNxdWFyZXNba10gPT09IGNuKSBzYW1lU3F1YXJlc1trXSA9IHRydWU7XG4gICAgICBlbHNlIGlmIChtb3ZlZFNxdWFyZXNbY25dKSBtb3ZlZFNxdWFyZXNbY25dLnB1c2goZWwpO1xuICAgICAgZWxzZSBtb3ZlZFNxdWFyZXNbY25dID0gW2VsXTtcbiAgICB9XG4gICAgZWwgPSBlbC5uZXh0U2libGluZyBhcyBjZy5QaWVjZU5vZGUgfCBjZy5TcXVhcmVOb2RlO1xuICB9XG5cbiAgLy8gd2FsayBvdmVyIGFsbCBzcXVhcmVzIGluIGN1cnJlbnQgc2V0LCBhcHBseSBkb20gY2hhbmdlcyB0byBtb3ZlZCBzcXVhcmVzXG4gIC8vIG9yIGFwcGVuZCBuZXcgc3F1YXJlc1xuICBmb3IgKGNvbnN0IHNrIGluIHNxdWFyZXMpIHtcbiAgICBpZiAoIXNhbWVTcXVhcmVzW3NrXSkge1xuICAgICAgc012ZHNldCA9IG1vdmVkU3F1YXJlc1tzcXVhcmVzW3NrXV07XG4gICAgICBzTXZkID0gc012ZHNldCAmJiBzTXZkc2V0LnBvcCgpO1xuICAgICAgY29uc3QgdHJhbnNsYXRpb24gPSBwb3NUb1RyYW5zbGF0ZShrZXkycG9zKHNrIGFzIGNnLktleSwgZmlyc3RSYW5rSXMwKSwgYXNXaGl0ZSwgcy5kaW1lbnNpb25zKTtcbiAgICAgIGlmIChzTXZkKSB7XG4gICAgICAgIHNNdmQuY2dLZXkgPSBzayBhcyBjZy5LZXk7XG4gICAgICAgIHRyYW5zbGF0ZShzTXZkLCB0cmFuc2xhdGlvbik7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3Qgc3F1YXJlTm9kZSA9IGNyZWF0ZUVsKCdzcXVhcmUnLCBzcXVhcmVzW3NrXSkgYXMgY2cuU3F1YXJlTm9kZTtcbiAgICAgICAgc3F1YXJlTm9kZS5jZ0tleSA9IHNrIGFzIGNnLktleTtcbiAgICAgICAgdHJhbnNsYXRlKHNxdWFyZU5vZGUsIHRyYW5zbGF0aW9uKTtcbiAgICAgICAgYm9hcmRFbC5pbnNlcnRCZWZvcmUoc3F1YXJlTm9kZSwgYm9hcmRFbC5maXJzdENoaWxkKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyB3YWxrIG92ZXIgYWxsIHBpZWNlcyBpbiBjdXJyZW50IHNldCwgYXBwbHkgZG9tIGNoYW5nZXMgdG8gbW92ZWQgcGllY2VzXG4gIC8vIG9yIGFwcGVuZCBuZXcgcGllY2VzXG4gIGZvciAoY29uc3QgaiBpbiBwaWVjZXNLZXlzKSB7XG4gICAgayA9IHBpZWNlc0tleXNbal07XG4gICAgcCA9IHBpZWNlc1trXSE7XG4gICAgYW5pbSA9IGFuaW1zW2tdO1xuICAgIGlmICghc2FtZVBpZWNlc1trXSkge1xuICAgICAgcE12ZHNldCA9IG1vdmVkUGllY2VzW3BpZWNlTmFtZU9mKHApXTtcbiAgICAgIHBNdmQgPSBwTXZkc2V0ICYmIHBNdmRzZXQucG9wKCk7XG4gICAgICAvLyBhIHNhbWUgcGllY2Ugd2FzIG1vdmVkXG4gICAgICBpZiAocE12ZCkge1xuICAgICAgICAvLyBhcHBseSBkb20gY2hhbmdlc1xuICAgICAgICBwTXZkLmNnS2V5ID0gaztcbiAgICAgICAgaWYgKHBNdmQuY2dGYWRpbmcpIHtcbiAgICAgICAgICBwTXZkLmNsYXNzTGlzdC5yZW1vdmUoJ2ZhZGluZycpO1xuICAgICAgICAgIHBNdmQuY2dGYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwb3MgPSBrZXkycG9zKGssIGZpcnN0UmFua0lzMCk7XG4gICAgICAgIGlmIChzLmFkZFBpZWNlWkluZGV4KSBwTXZkLnN0eWxlLnpJbmRleCA9IHBvc1pJbmRleChwb3MsIGFzV2hpdGUpO1xuICAgICAgICBpZiAoYW5pbSkge1xuICAgICAgICAgIHBNdmQuY2dBbmltYXRpbmcgPSB0cnVlO1xuICAgICAgICAgIHBNdmQuY2xhc3NMaXN0LmFkZCgnYW5pbScpO1xuICAgICAgICAgIHBvc1swXSArPSBhbmltWzJdO1xuICAgICAgICAgIHBvc1sxXSArPSBhbmltWzNdO1xuICAgICAgICB9XG4gICAgICAgIHRyYW5zbGF0ZShwTXZkLCBwb3NUb1RyYW5zbGF0ZShwb3MsIGFzV2hpdGUsIHMuZGltZW5zaW9ucykpO1xuICAgICAgfVxuICAgICAgLy8gbm8gcGllY2UgaW4gbW92ZWQgb2JqOiBpbnNlcnQgdGhlIG5ldyBwaWVjZVxuICAgICAgLy8gYXNzdW1lcyB0aGUgbmV3IHBpZWNlIGlzIG5vdCBiZWluZyBkcmFnZ2VkXG4gICAgICBlbHNlIHtcblxuICAgICAgICBjb25zdCBwaWVjZU5hbWUgPSBwaWVjZU5hbWVPZihwKSxcbiAgICAgICAgcGllY2VOb2RlID0gY3JlYXRlRWwoJ3BpZWNlJywgcGllY2VOYW1lKSBhcyBjZy5QaWVjZU5vZGUsXG4gICAgICAgIHBvcyA9IGtleTJwb3MoaywgZmlyc3RSYW5rSXMwKTtcblxuICAgICAgICBwaWVjZU5vZGUuY2dQaWVjZSA9IHBpZWNlTmFtZTtcbiAgICAgICAgcGllY2VOb2RlLmNnS2V5ID0gaztcbiAgICAgICAgaWYgKGFuaW0pIHtcbiAgICAgICAgICBwaWVjZU5vZGUuY2dBbmltYXRpbmcgPSB0cnVlO1xuICAgICAgICAgIHBvc1swXSArPSBhbmltWzJdO1xuICAgICAgICAgIHBvc1sxXSArPSBhbmltWzNdO1xuICAgICAgICB9XG4gICAgICAgIHRyYW5zbGF0ZShwaWVjZU5vZGUsIHBvc1RvVHJhbnNsYXRlKHBvcywgYXNXaGl0ZSwgcy5kaW1lbnNpb25zKSk7XG5cbiAgICAgICAgaWYgKHMuYWRkUGllY2VaSW5kZXgpIHBpZWNlTm9kZS5zdHlsZS56SW5kZXggPSBwb3NaSW5kZXgocG9zLCBhc1doaXRlKTtcblxuICAgICAgICBib2FyZEVsLmFwcGVuZENoaWxkKHBpZWNlTm9kZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gcmVtb3ZlIGFueSBlbGVtZW50IHRoYXQgcmVtYWlucyBpbiB0aGUgbW92ZWQgc2V0c1xuICBmb3IgKGNvbnN0IGkgaW4gbW92ZWRQaWVjZXMpIHJlbW92ZU5vZGVzKHMsIG1vdmVkUGllY2VzW2ldKTtcbiAgZm9yIChjb25zdCBpIGluIG1vdmVkU3F1YXJlcykgcmVtb3ZlTm9kZXMocywgbW92ZWRTcXVhcmVzW2ldKTtcbn1cblxuZnVuY3Rpb24gaXNQaWVjZU5vZGUoZWw6IGNnLlBpZWNlTm9kZSB8IGNnLlNxdWFyZU5vZGUpOiBlbCBpcyBjZy5QaWVjZU5vZGUge1xuICByZXR1cm4gZWwudGFnTmFtZSA9PT0gJ1BJRUNFJztcbn1cbmZ1bmN0aW9uIGlzU3F1YXJlTm9kZShlbDogY2cuUGllY2VOb2RlIHwgY2cuU3F1YXJlTm9kZSk6IGVsIGlzIGNnLlNxdWFyZU5vZGUge1xuICByZXR1cm4gZWwudGFnTmFtZSA9PT0gJ1NRVUFSRSc7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZU5vZGVzKHM6IFN0YXRlLCBub2RlczogSFRNTEVsZW1lbnRbXSk6IHZvaWQge1xuICBmb3IgKGNvbnN0IGkgaW4gbm9kZXMpIHMuZG9tLmVsZW1lbnRzLmJvYXJkLnJlbW92ZUNoaWxkKG5vZGVzW2ldKTtcbn1cblxuZnVuY3Rpb24gcG9zWkluZGV4KHBvczogY2cuUG9zLCBhc1doaXRlOiBib29sZWFuKTogc3RyaW5nIHtcbiAgbGV0IHogPSAyICsgKHBvc1sxXSAtIDEpICogOCArICg4IC0gcG9zWzBdKTtcbiAgaWYgKGFzV2hpdGUpIHogPSA2NyAtIHo7XG4gIHJldHVybiB6ICsgJyc7XG59XG5cbmZ1bmN0aW9uIHBpZWNlTmFtZU9mKHBpZWNlOiBjZy5QaWVjZSk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtwaWVjZS5jb2xvcn0gJHtwaWVjZS5yb2xlfWA7XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVTcXVhcmVDbGFzc2VzKHM6IFN0YXRlKTogU3F1YXJlQ2xhc3NlcyB7XG4gIGNvbnN0IHNxdWFyZXM6IFNxdWFyZUNsYXNzZXMgPSB7fTtcbiAgbGV0IGk6IGFueSwgazogY2cuS2V5O1xuICBpZiAocy5sYXN0TW92ZSAmJiBzLmhpZ2hsaWdodC5sYXN0TW92ZSkgZm9yIChpIGluIHMubGFzdE1vdmUpIHtcbiAgICBpZiAocy5sYXN0TW92ZVtpXSAhPSAnYTAnKSB7XG4gICAgICBhZGRTcXVhcmUoc3F1YXJlcywgcy5sYXN0TW92ZVtpXSwgJ2xhc3QtbW92ZScpO1xuICAgIH1cbiAgfVxuICBpZiAocy5jaGVjayAmJiBzLmhpZ2hsaWdodC5jaGVjaykgYWRkU3F1YXJlKHNxdWFyZXMsIHMuY2hlY2ssICdjaGVjaycpO1xuICBpZiAocy5zZWxlY3RlZCkge1xuICAgIGlmIChzLnNlbGVjdGVkICE9ICdhMCcpIHtcbiAgICAgIGFkZFNxdWFyZShzcXVhcmVzLCBzLnNlbGVjdGVkLCAnc2VsZWN0ZWQnKTtcbiAgICB9XG4gICAgaWYgKHMubW92YWJsZS5zaG93RGVzdHMpIHtcbiAgICAgIGNvbnN0IGRlc3RzID0gcy5tb3ZhYmxlLmRlc3RzICYmIHMubW92YWJsZS5kZXN0c1tzLnNlbGVjdGVkXTtcbiAgICAgIGlmIChkZXN0cykgZm9yIChpIGluIGRlc3RzKSB7XG4gICAgICAgIGsgPSBkZXN0c1tpXTtcbiAgICAgICAgYWRkU3F1YXJlKHNxdWFyZXMsIGssICdtb3ZlLWRlc3QnICsgKHMucGllY2VzW2tdID8gJyBvYycgOiAnJykpO1xuICAgICAgfVxuICAgICAgY29uc3QgcERlc3RzID0gcy5wcmVtb3ZhYmxlLmRlc3RzO1xuICAgICAgaWYgKHBEZXN0cykgZm9yIChpIGluIHBEZXN0cykge1xuICAgICAgICBrID0gcERlc3RzW2ldO1xuICAgICAgICBhZGRTcXVhcmUoc3F1YXJlcywgaywgJ3ByZW1vdmUtZGVzdCcgKyAocy5waWVjZXNba10gPyAnIG9jJyA6ICcnKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbnN0IHByZW1vdmUgPSBzLnByZW1vdmFibGUuY3VycmVudDtcbiAgaWYgKHByZW1vdmUpIGZvciAoaSBpbiBwcmVtb3ZlKSBhZGRTcXVhcmUoc3F1YXJlcywgcHJlbW92ZVtpXSwgJ2N1cnJlbnQtcHJlbW92ZScpO1xuICBlbHNlIGlmIChzLnByZWRyb3BwYWJsZS5jdXJyZW50KSBhZGRTcXVhcmUoc3F1YXJlcywgcy5wcmVkcm9wcGFibGUuY3VycmVudC5rZXksICdjdXJyZW50LXByZW1vdmUnKTtcblxuICBjb25zdCBvID0gcy5leHBsb2Rpbmc7XG4gIGlmIChvKSBmb3IgKGkgaW4gby5rZXlzKSBhZGRTcXVhcmUoc3F1YXJlcywgby5rZXlzW2ldLCAnZXhwbG9kaW5nJyArIG8uc3RhZ2UpO1xuXG4gIHJldHVybiBzcXVhcmVzO1xufVxuXG5mdW5jdGlvbiBhZGRTcXVhcmUoc3F1YXJlczogU3F1YXJlQ2xhc3Nlcywga2V5OiBjZy5LZXksIGtsYXNzOiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKHNxdWFyZXNba2V5XSkgc3F1YXJlc1trZXldICs9ICcgJyArIGtsYXNzO1xuICBlbHNlIHNxdWFyZXNba2V5XSA9IGtsYXNzO1xufVxuIiwiaW1wb3J0ICogYXMgZmVuIGZyb20gJy4vZmVuJ1xuaW1wb3J0IHsgQW5pbUN1cnJlbnQgfSBmcm9tICcuL2FuaW0nXG5pbXBvcnQgeyBEcmFnQ3VycmVudCB9IGZyb20gJy4vZHJhZydcbmltcG9ydCB7IERyYXdhYmxlIH0gZnJvbSAnLi9kcmF3J1xuaW1wb3J0IHsgdGltZXIgfSBmcm9tICcuL3V0aWwnXG5pbXBvcnQgKiBhcyBjZyBmcm9tICcuL3R5cGVzJztcblxuZXhwb3J0IGludGVyZmFjZSBTdGF0ZSB7XG4gIHBpZWNlczogY2cuUGllY2VzO1xuICBvcmllbnRhdGlvbjogY2cuQ29sb3I7IC8vIGJvYXJkIG9yaWVudGF0aW9uLiB3aGl0ZSB8IGJsYWNrXG4gIHR1cm5Db2xvcjogY2cuQ29sb3I7IC8vIHR1cm4gdG8gcGxheS4gd2hpdGUgfCBibGFja1xuICBjaGVjaz86IGNnLktleTsgLy8gc3F1YXJlIGN1cnJlbnRseSBpbiBjaGVjayBcImEyXCJcbiAgbGFzdE1vdmU/OiBjZy5LZXlbXTsgLy8gc3F1YXJlcyBwYXJ0IG9mIHRoZSBsYXN0IG1vdmUgW1wiYzNcIjsgXCJjNFwiXVxuICBzZWxlY3RlZD86IGNnLktleTsgLy8gc3F1YXJlIGN1cnJlbnRseSBzZWxlY3RlZCBcImExXCJcbiAgY29vcmRpbmF0ZXM6IGJvb2xlYW47IC8vIGluY2x1ZGUgY29vcmRzIGF0dHJpYnV0ZXNcbiAgYXV0b0Nhc3RsZTogYm9vbGVhbjsgLy8gaW1tZWRpYXRlbHkgY29tcGxldGUgdGhlIGNhc3RsZSBieSBtb3ZpbmcgdGhlIHJvb2sgYWZ0ZXIga2luZyBtb3ZlXG4gIHZpZXdPbmx5OiBib29sZWFuOyAvLyBkb24ndCBiaW5kIGV2ZW50czogdGhlIHVzZXIgd2lsbCBuZXZlciBiZSBhYmxlIHRvIG1vdmUgcGllY2VzIGFyb3VuZFxuICBkaXNhYmxlQ29udGV4dE1lbnU6IGJvb2xlYW47IC8vIGJlY2F1c2Ugd2hvIG5lZWRzIGEgY29udGV4dCBtZW51IG9uIGEgY2hlc3Nib2FyZFxuICByZXNpemFibGU6IGJvb2xlYW47IC8vIGxpc3RlbnMgdG8gY2hlc3Nncm91bmQucmVzaXplIG9uIGRvY3VtZW50LmJvZHkgdG8gY2xlYXIgYm91bmRzIGNhY2hlXG4gIGFkZFBpZWNlWkluZGV4OiBib29sZWFuOyAvLyBhZGRzIHotaW5kZXggdmFsdWVzIHRvIHBpZWNlcyAoZm9yIDNEKVxuICBwaWVjZUtleTogYm9vbGVhbjsgLy8gYWRkIGEgZGF0YS1rZXkgYXR0cmlidXRlIHRvIHBpZWNlIGVsZW1lbnRzXG4gIGhpZ2hsaWdodDoge1xuICAgIGxhc3RNb3ZlOiBib29sZWFuOyAvLyBhZGQgbGFzdC1tb3ZlIGNsYXNzIHRvIHNxdWFyZXNcbiAgICBjaGVjazogYm9vbGVhbjsgLy8gYWRkIGNoZWNrIGNsYXNzIHRvIHNxdWFyZXNcbiAgfTtcbiAgYW5pbWF0aW9uOiB7XG4gICAgZW5hYmxlZDogYm9vbGVhbjtcbiAgICBkdXJhdGlvbjogbnVtYmVyO1xuICAgIGN1cnJlbnQ/OiBBbmltQ3VycmVudDtcbiAgfTtcbiAgbW92YWJsZToge1xuICAgIGZyZWU6IGJvb2xlYW47IC8vIGFsbCBtb3ZlcyBhcmUgdmFsaWQgLSBib2FyZCBlZGl0b3JcbiAgICBjb2xvcj86IGNnLkNvbG9yIHwgJ2JvdGgnOyAvLyBjb2xvciB0aGF0IGNhbiBtb3ZlLiB3aGl0ZSB8IGJsYWNrIHwgYm90aFxuICAgIGRlc3RzPzogY2cuRGVzdHM7IC8vIHZhbGlkIG1vdmVzLiB7XCJhMlwiIFtcImEzXCIgXCJhNFwiXSBcImIxXCIgW1wiYTNcIiBcImMzXCJdfVxuICAgIHNob3dEZXN0czogYm9vbGVhbjsgLy8gd2hldGhlciB0byBhZGQgdGhlIG1vdmUtZGVzdCBjbGFzcyBvbiBzcXVhcmVzXG4gICAgZXZlbnRzOiB7XG4gICAgICBhZnRlcj86IChvcmlnOiBjZy5LZXksIGRlc3Q6IGNnLktleSwgbWV0YWRhdGE6IGNnLk1vdmVNZXRhZGF0YSkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIHRoZSBtb3ZlIGhhcyBiZWVuIHBsYXllZFxuICAgICAgYWZ0ZXJOZXdQaWVjZT86IChyb2xlOiBjZy5Sb2xlLCBrZXk6IGNnLktleSwgbWV0YWRhdGE6IGNnLk1vdmVNZXRhZGF0YSkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIGEgbmV3IHBpZWNlIGlzIGRyb3BwZWQgb24gdGhlIGJvYXJkXG4gICAgfTtcbiAgICByb29rQ2FzdGxlOiBib29sZWFuIC8vIGNhc3RsZSBieSBtb3ZpbmcgdGhlIGtpbmcgdG8gdGhlIHJvb2tcbiAgfTtcbiAgcHJlbW92YWJsZToge1xuICAgIGVuYWJsZWQ6IGJvb2xlYW47IC8vIGFsbG93IHByZW1vdmVzIGZvciBjb2xvciB0aGF0IGNhbiBub3QgbW92ZVxuICAgIHNob3dEZXN0czogYm9vbGVhbjsgLy8gd2hldGhlciB0byBhZGQgdGhlIHByZW1vdmUtZGVzdCBjbGFzcyBvbiBzcXVhcmVzXG4gICAgY2FzdGxlOiBib29sZWFuOyAvLyB3aGV0aGVyIHRvIGFsbG93IGtpbmcgY2FzdGxlIHByZW1vdmVzXG4gICAgZGVzdHM/OiBjZy5LZXlbXTsgLy8gcHJlbW92ZSBkZXN0aW5hdGlvbnMgZm9yIHRoZSBjdXJyZW50IHNlbGVjdGlvblxuICAgIGN1cnJlbnQ/OiBjZy5LZXlQYWlyOyAvLyBrZXlzIG9mIHRoZSBjdXJyZW50IHNhdmVkIHByZW1vdmUgW1wiZTJcIiBcImU0XCJdXG4gICAgZXZlbnRzOiB7XG4gICAgICBzZXQ/OiAob3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXksIG1ldGFkYXRhPzogY2cuU2V0UHJlbW92ZU1ldGFkYXRhKSA9PiB2b2lkOyAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHByZW1vdmUgaGFzIGJlZW4gc2V0XG4gICAgICB1bnNldD86ICgpID0+IHZvaWQ7ICAvLyBjYWxsZWQgYWZ0ZXIgdGhlIHByZW1vdmUgaGFzIGJlZW4gdW5zZXRcbiAgICB9XG4gIH07XG4gIHByZWRyb3BwYWJsZToge1xuICAgIGVuYWJsZWQ6IGJvb2xlYW47IC8vIGFsbG93IHByZWRyb3BzIGZvciBjb2xvciB0aGF0IGNhbiBub3QgbW92ZVxuICAgIGN1cnJlbnQ/OiB7IC8vIGN1cnJlbnQgc2F2ZWQgcHJlZHJvcCB7cm9sZTogJ2tuaWdodCc7IGtleTogJ2U0J31cbiAgICAgIHJvbGU6IGNnLlJvbGU7XG4gICAgICBrZXk6IGNnLktleVxuICAgIH07XG4gICAgZXZlbnRzOiB7XG4gICAgICBzZXQ/OiAocm9sZTogY2cuUm9sZSwga2V5OiBjZy5LZXkpID0+IHZvaWQ7IC8vIGNhbGxlZCBhZnRlciB0aGUgcHJlZHJvcCBoYXMgYmVlbiBzZXRcbiAgICAgIHVuc2V0PzogKCkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIHRoZSBwcmVkcm9wIGhhcyBiZWVuIHVuc2V0XG4gICAgfVxuICB9O1xuICBkcmFnZ2FibGU6IHtcbiAgICBlbmFibGVkOiBib29sZWFuOyAvLyBhbGxvdyBtb3ZlcyAmIHByZW1vdmVzIHRvIHVzZSBkcmFnJ24gZHJvcFxuICAgIGRpc3RhbmNlOiBudW1iZXI7IC8vIG1pbmltdW0gZGlzdGFuY2UgdG8gaW5pdGlhdGUgYSBkcmFnOyBpbiBwaXhlbHNcbiAgICBhdXRvRGlzdGFuY2U6IGJvb2xlYW47IC8vIGxldHMgY2hlc3Nncm91bmQgc2V0IGRpc3RhbmNlIHRvIHplcm8gd2hlbiB1c2VyIGRyYWdzIHBpZWNlc1xuICAgIGNlbnRlclBpZWNlOiBib29sZWFuOyAvLyBjZW50ZXIgdGhlIHBpZWNlIG9uIGN1cnNvciBhdCBkcmFnIHN0YXJ0XG4gICAgc2hvd0dob3N0OiBib29sZWFuOyAvLyBzaG93IGdob3N0IG9mIHBpZWNlIGJlaW5nIGRyYWdnZWRcbiAgICBkZWxldGVPbkRyb3BPZmY6IGJvb2xlYW47IC8vIGRlbGV0ZSBhIHBpZWNlIHdoZW4gaXQgaXMgZHJvcHBlZCBvZmYgdGhlIGJvYXJkXG4gICAgY3VycmVudD86IERyYWdDdXJyZW50O1xuICB9O1xuICBkcm9wbW9kZToge1xuICAgIGFjdGl2ZTogYm9vbGVhbjtcbiAgICBwaWVjZT86IGNnLlBpZWNlO1xuICB9XG4gIHNlbGVjdGFibGU6IHtcbiAgICAvLyBkaXNhYmxlIHRvIGVuZm9yY2UgZHJhZ2dpbmcgb3ZlciBjbGljay1jbGljayBtb3ZlXG4gICAgZW5hYmxlZDogYm9vbGVhblxuICB9O1xuICBzdGF0czoge1xuICAgIC8vIHdhcyBsYXN0IHBpZWNlIGRyYWdnZWQgb3IgY2xpY2tlZD9cbiAgICAvLyBuZWVkcyBkZWZhdWx0IHRvIGZhbHNlIGZvciB0b3VjaFxuICAgIGRyYWdnZWQ6IGJvb2xlYW4sXG4gICAgY3RybEtleT86IGJvb2xlYW5cbiAgfTtcbiAgZXZlbnRzOiB7XG4gICAgY2hhbmdlPzogKCkgPT4gdm9pZDsgLy8gY2FsbGVkIGFmdGVyIHRoZSBzaXR1YXRpb24gY2hhbmdlcyBvbiB0aGUgYm9hcmRcbiAgICAvLyBjYWxsZWQgYWZ0ZXIgYSBwaWVjZSBoYXMgYmVlbiBtb3ZlZC5cbiAgICAvLyBjYXB0dXJlZFBpZWNlIGlzIHVuZGVmaW5lZCBvciBsaWtlIHtjb2xvcjogJ3doaXRlJzsgJ3JvbGUnOiAncXVlZW4nfVxuICAgIG1vdmU/OiAob3JpZzogY2cuS2V5LCBkZXN0OiBjZy5LZXksIGNhcHR1cmVkUGllY2U/OiBjZy5QaWVjZSkgPT4gdm9pZDtcbiAgICBkcm9wTmV3UGllY2U/OiAocGllY2U6IGNnLlBpZWNlLCBrZXk6IGNnLktleSkgPT4gdm9pZDtcbiAgICBzZWxlY3Q/OiAoa2V5OiBjZy5LZXkpID0+IHZvaWQgLy8gY2FsbGVkIHdoZW4gYSBzcXVhcmUgaXMgc2VsZWN0ZWRcbiAgICBpbnNlcnQ/OiAoZWxlbWVudHM6IGNnLkVsZW1lbnRzKSA9PiB2b2lkOyAvLyB3aGVuIHRoZSBib2FyZCBET00gaGFzIGJlZW4gKHJlKWluc2VydGVkXG4gIH07XG4gIGRyYXdhYmxlOiBEcmF3YWJsZSxcbiAgZXhwbG9kaW5nPzogY2cuRXhwbG9kaW5nO1xuICBkb206IGNnLkRvbSxcbiAgaG9sZDogY2cuVGltZXIsXG4gIGRpbWVuc2lvbnM6IGNnLkJvYXJkRGltZW5zaW9ucywgLy8gbnVtYmVyIG9mIGxpbmVzIGFuZCByYW5rcyBvZiB0aGUgYm9hcmQge3dpZHRoOiAxMCwgaGVpZ2h0OiA4fVxuICBnZW9tZXRyeTogY2cuR2VvbWV0cnksIC8vIGRpbTh4OCB8IGRpbTl4OSB8IGRpbTEweDggfCBkaW05eDEwXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZhdWx0cygpOiBQYXJ0aWFsPFN0YXRlPiB7XG4gIHJldHVybiB7XG4gICAgcGllY2VzOiBmZW4ucmVhZChmZW4uaW5pdGlhbCksXG4gICAgb3JpZW50YXRpb246ICd3aGl0ZScsXG4gICAgdHVybkNvbG9yOiAnd2hpdGUnLFxuICAgIGNvb3JkaW5hdGVzOiB0cnVlLFxuICAgIGF1dG9DYXN0bGU6IHRydWUsXG4gICAgdmlld09ubHk6IGZhbHNlLFxuICAgIGRpc2FibGVDb250ZXh0TWVudTogZmFsc2UsXG4gICAgcmVzaXphYmxlOiB0cnVlLFxuICAgIGFkZFBpZWNlWkluZGV4OiBmYWxzZSxcbiAgICBwaWVjZUtleTogZmFsc2UsXG4gICAgaGlnaGxpZ2h0OiB7XG4gICAgICBsYXN0TW92ZTogdHJ1ZSxcbiAgICAgIGNoZWNrOiB0cnVlXG4gICAgfSxcbiAgICBhbmltYXRpb246IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBkdXJhdGlvbjogMjAwXG4gICAgfSxcbiAgICBtb3ZhYmxlOiB7XG4gICAgICBmcmVlOiB0cnVlLFxuICAgICAgY29sb3I6ICdib3RoJyxcbiAgICAgIHNob3dEZXN0czogdHJ1ZSxcbiAgICAgIGV2ZW50czoge30sXG4gICAgICByb29rQ2FzdGxlOiB0cnVlXG4gICAgfSxcbiAgICBwcmVtb3ZhYmxlOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgc2hvd0Rlc3RzOiB0cnVlLFxuICAgICAgY2FzdGxlOiB0cnVlLFxuICAgICAgZXZlbnRzOiB7fVxuICAgIH0sXG4gICAgcHJlZHJvcHBhYmxlOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgIGV2ZW50czoge31cbiAgICB9LFxuICAgIGRyYWdnYWJsZToge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGRpc3RhbmNlOiAzLFxuICAgICAgYXV0b0Rpc3RhbmNlOiB0cnVlLFxuICAgICAgY2VudGVyUGllY2U6IHRydWUsXG4gICAgICBzaG93R2hvc3Q6IHRydWUsXG4gICAgICBkZWxldGVPbkRyb3BPZmY6IGZhbHNlXG4gICAgfSxcbiAgICBkcm9wbW9kZToge1xuICAgICAgYWN0aXZlOiBmYWxzZVxuICAgIH0sXG4gICAgc2VsZWN0YWJsZToge1xuICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgIH0sXG4gICAgc3RhdHM6IHtcbiAgICAgIC8vIG9uIHRvdWNoc2NyZWVuLCBkZWZhdWx0IHRvIFwidGFwLXRhcFwiIG1vdmVzXG4gICAgICAvLyBpbnN0ZWFkIG9mIGRyYWdcbiAgICAgIGRyYWdnZWQ6ICEoJ29udG91Y2hzdGFydCcgaW4gd2luZG93KVxuICAgIH0sXG4gICAgZXZlbnRzOiB7fSxcbiAgICBkcmF3YWJsZToge1xuICAgICAgZW5hYmxlZDogdHJ1ZSwgLy8gY2FuIGRyYXdcbiAgICAgIHZpc2libGU6IHRydWUsIC8vIGNhbiB2aWV3XG4gICAgICBlcmFzZU9uQ2xpY2s6IHRydWUsXG4gICAgICBzaGFwZXM6IFtdLFxuICAgICAgYXV0b1NoYXBlczogW10sXG4gICAgICBicnVzaGVzOiB7XG4gICAgICAgIGdyZWVuOiB7IGtleTogJ2cnLCBjb2xvcjogJyMxNTc4MUInLCBvcGFjaXR5OiAxLCBsaW5lV2lkdGg6IDEwIH0sXG4gICAgICAgIHJlZDogeyBrZXk6ICdyJywgY29sb3I6ICcjODgyMDIwJywgb3BhY2l0eTogMSwgbGluZVdpZHRoOiAxMCB9LFxuICAgICAgICBibHVlOiB7IGtleTogJ2InLCBjb2xvcjogJyMwMDMwODgnLCBvcGFjaXR5OiAxLCBsaW5lV2lkdGg6IDEwIH0sXG4gICAgICAgIHllbGxvdzogeyBrZXk6ICd5JywgY29sb3I6ICcjZTY4ZjAwJywgb3BhY2l0eTogMSwgbGluZVdpZHRoOiAxMCB9LFxuICAgICAgICBwYWxlQmx1ZTogeyBrZXk6ICdwYicsIGNvbG9yOiAnIzAwMzA4OCcsIG9wYWNpdHk6IDAuNCwgbGluZVdpZHRoOiAxNSB9LFxuICAgICAgICBwYWxlR3JlZW46IHsga2V5OiAncGcnLCBjb2xvcjogJyMxNTc4MUInLCBvcGFjaXR5OiAwLjQsIGxpbmVXaWR0aDogMTUgfSxcbiAgICAgICAgcGFsZVJlZDogeyBrZXk6ICdwcicsIGNvbG9yOiAnIzg4MjAyMCcsIG9wYWNpdHk6IDAuNCwgbGluZVdpZHRoOiAxNSB9LFxuICAgICAgICBwYWxlR3JleTogeyBrZXk6ICdwZ3InLCBjb2xvcjogJyM0YTRhNGEnLCBvcGFjaXR5OiAwLjM1LCBsaW5lV2lkdGg6IDE1IH1cbiAgICAgIH0sXG4gICAgICBwaWVjZXM6IHtcbiAgICAgICAgYmFzZVVybDogJ2h0dHBzOi8vbGljaGVzczEub3JnL2Fzc2V0cy9waWVjZS9jYnVybmV0dC8nXG4gICAgICB9LFxuICAgICAgcHJldlN2Z0hhc2g6ICcnXG4gICAgfSxcbiAgICBob2xkOiB0aW1lcigpLFxuICAgIGRpbWVuc2lvbnM6IHt3aWR0aDogOCwgaGVpZ2h0OiA4fSxcbiAgICBnZW9tZXRyeTogY2cuR2VvbWV0cnkuZGltOHg4LFxuICB9O1xufVxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xuaW1wb3J0IHsga2V5MnBvcyB9IGZyb20gJy4vdXRpbCdcbmltcG9ydCB7IERyYXdhYmxlLCBEcmF3U2hhcGUsIERyYXdTaGFwZVBpZWNlLCBEcmF3QnJ1c2gsIERyYXdCcnVzaGVzLCBEcmF3TW9kaWZpZXJzIH0gZnJvbSAnLi9kcmF3J1xuaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcydcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodGFnTmFtZTogc3RyaW5nKTogU1ZHRWxlbWVudCB7XG4gIHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgdGFnTmFtZSk7XG59XG5cbmludGVyZmFjZSBTaGFwZSB7XG4gIHNoYXBlOiBEcmF3U2hhcGU7XG4gIGN1cnJlbnQ6IGJvb2xlYW47XG4gIGhhc2g6IEhhc2g7XG59XG5cbmludGVyZmFjZSBDdXN0b21CcnVzaGVzIHtcbiAgW2hhc2g6IHN0cmluZ106IERyYXdCcnVzaFxufVxuXG5pbnRlcmZhY2UgQXJyb3dEZXN0cyB7XG4gIFtrZXk6IHN0cmluZ106IG51bWJlcjsgLy8gaG93IG1hbnkgYXJyb3dzIGxhbmQgb24gYSBzcXVhcmVcbn1cblxudHlwZSBIYXNoID0gc3RyaW5nO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyU3ZnKHN0YXRlOiBTdGF0ZSwgcm9vdDogU1ZHRWxlbWVudCk6IHZvaWQge1xuXG4gIGNvbnN0IGQgPSBzdGF0ZS5kcmF3YWJsZSxcbiAgY3VyRCA9IGQuY3VycmVudCxcbiAgY3VyID0gY3VyRCAmJiBjdXJELm1vdXNlU3EgPyBjdXJEIGFzIERyYXdTaGFwZSA6IHVuZGVmaW5lZCxcbiAgYXJyb3dEZXN0czogQXJyb3dEZXN0cyA9IHt9O1xuXG4gIGQuc2hhcGVzLmNvbmNhdChkLmF1dG9TaGFwZXMpLmNvbmNhdChjdXIgPyBbY3VyXSA6IFtdKS5mb3JFYWNoKHMgPT4ge1xuICAgIGlmIChzLmRlc3QpIGFycm93RGVzdHNbcy5kZXN0XSA9IChhcnJvd0Rlc3RzW3MuZGVzdF0gfHwgMCkgKyAxO1xuICB9KTtcblxuICBjb25zdCBzaGFwZXM6IFNoYXBlW10gPSBkLnNoYXBlcy5jb25jYXQoZC5hdXRvU2hhcGVzKS5tYXAoKHM6IERyYXdTaGFwZSkgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICBzaGFwZTogcyxcbiAgICAgIGN1cnJlbnQ6IGZhbHNlLFxuICAgICAgaGFzaDogc2hhcGVIYXNoKHMsIGFycm93RGVzdHMsIGZhbHNlKVxuICAgIH07XG4gIH0pO1xuICBpZiAoY3VyKSBzaGFwZXMucHVzaCh7XG4gICAgc2hhcGU6IGN1cixcbiAgICBjdXJyZW50OiB0cnVlLFxuICAgIGhhc2g6IHNoYXBlSGFzaChjdXIsIGFycm93RGVzdHMsIHRydWUpXG4gIH0pO1xuXG4gIGNvbnN0IGZ1bGxIYXNoID0gc2hhcGVzLm1hcChzYyA9PiBzYy5oYXNoKS5qb2luKCcnKTtcbiAgaWYgKGZ1bGxIYXNoID09PSBzdGF0ZS5kcmF3YWJsZS5wcmV2U3ZnSGFzaCkgcmV0dXJuO1xuICBzdGF0ZS5kcmF3YWJsZS5wcmV2U3ZnSGFzaCA9IGZ1bGxIYXNoO1xuXG4gIGNvbnN0IGRlZnNFbCA9IHJvb3QuZmlyc3RDaGlsZCBhcyBTVkdFbGVtZW50O1xuXG4gIHN5bmNEZWZzKGQsIHNoYXBlcywgZGVmc0VsKTtcbiAgc3luY1NoYXBlcyhzdGF0ZSwgc2hhcGVzLCBkLmJydXNoZXMsIGFycm93RGVzdHMsIHJvb3QsIGRlZnNFbCk7XG59XG5cbi8vIGFwcGVuZCBvbmx5LiBEb24ndCB0cnkgdG8gdXBkYXRlL3JlbW92ZS5cbmZ1bmN0aW9uIHN5bmNEZWZzKGQ6IERyYXdhYmxlLCBzaGFwZXM6IFNoYXBlW10sIGRlZnNFbDogU1ZHRWxlbWVudCkge1xuICBjb25zdCBicnVzaGVzOiBDdXN0b21CcnVzaGVzID0ge307XG4gIGxldCBicnVzaDogRHJhd0JydXNoO1xuICBzaGFwZXMuZm9yRWFjaChzID0+IHtcbiAgICBpZiAocy5zaGFwZS5kZXN0KSB7XG4gICAgICBicnVzaCA9IGQuYnJ1c2hlc1tzLnNoYXBlLmJydXNoXTtcbiAgICAgIGlmIChzLnNoYXBlLm1vZGlmaWVycykgYnJ1c2ggPSBtYWtlQ3VzdG9tQnJ1c2goYnJ1c2gsIHMuc2hhcGUubW9kaWZpZXJzKTtcbiAgICAgIGJydXNoZXNbYnJ1c2gua2V5XSA9IGJydXNoO1xuICAgIH1cbiAgfSk7XG4gIGNvbnN0IGtleXNJbkRvbToge1trZXk6IHN0cmluZ106IGJvb2xlYW59ID0ge307XG4gIGxldCBlbDogU1ZHRWxlbWVudCA9IGRlZnNFbC5maXJzdENoaWxkIGFzIFNWR0VsZW1lbnQ7XG4gIHdoaWxlKGVsKSB7XG4gICAga2V5c0luRG9tW2VsLmdldEF0dHJpYnV0ZSgnY2dLZXknKSBhcyBzdHJpbmddID0gdHJ1ZTtcbiAgICBlbCA9IGVsLm5leHRTaWJsaW5nIGFzIFNWR0VsZW1lbnQ7XG4gIH1cbiAgZm9yIChsZXQga2V5IGluIGJydXNoZXMpIHtcbiAgICBpZiAoIWtleXNJbkRvbVtrZXldKSBkZWZzRWwuYXBwZW5kQ2hpbGQocmVuZGVyTWFya2VyKGJydXNoZXNba2V5XSkpO1xuICB9XG59XG5cbi8vIGFwcGVuZCBhbmQgcmVtb3ZlIG9ubHkuIE5vIHVwZGF0ZXMuXG5mdW5jdGlvbiBzeW5jU2hhcGVzKHN0YXRlOiBTdGF0ZSwgc2hhcGVzOiBTaGFwZVtdLCBicnVzaGVzOiBEcmF3QnJ1c2hlcywgYXJyb3dEZXN0czogQXJyb3dEZXN0cywgcm9vdDogU1ZHRWxlbWVudCwgZGVmc0VsOiBTVkdFbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IGJvdW5kcyA9IHN0YXRlLmRvbS5ib3VuZHMoKSxcbiAgaGFzaGVzSW5Eb206IHtbaGFzaDogc3RyaW5nXTogYm9vbGVhbn0gPSB7fSxcbiAgdG9SZW1vdmU6IFNWR0VsZW1lbnRbXSA9IFtdO1xuICBzaGFwZXMuZm9yRWFjaChzYyA9PiB7IGhhc2hlc0luRG9tW3NjLmhhc2hdID0gZmFsc2U7IH0pO1xuICBsZXQgZWw6IFNWR0VsZW1lbnQgPSBkZWZzRWwubmV4dFNpYmxpbmcgYXMgU1ZHRWxlbWVudCwgZWxIYXNoOiBIYXNoO1xuICB3aGlsZShlbCkge1xuICAgIGVsSGFzaCA9IGVsLmdldEF0dHJpYnV0ZSgnY2dIYXNoJykgYXMgSGFzaDtcbiAgICAvLyBmb3VuZCBhIHNoYXBlIGVsZW1lbnQgdGhhdCdzIGhlcmUgdG8gc3RheVxuICAgIGlmIChoYXNoZXNJbkRvbS5oYXNPd25Qcm9wZXJ0eShlbEhhc2gpKSBoYXNoZXNJbkRvbVtlbEhhc2hdID0gdHJ1ZTtcbiAgICAvLyBvciByZW1vdmUgaXRcbiAgICBlbHNlIHRvUmVtb3ZlLnB1c2goZWwpO1xuICAgIGVsID0gZWwubmV4dFNpYmxpbmcgYXMgU1ZHRWxlbWVudDtcbiAgfVxuICAvLyByZW1vdmUgb2xkIHNoYXBlc1xuICB0b1JlbW92ZS5mb3JFYWNoKGVsID0+IHJvb3QucmVtb3ZlQ2hpbGQoZWwpKTtcbiAgLy8gaW5zZXJ0IHNoYXBlcyB0aGF0IGFyZSBub3QgeWV0IGluIGRvbVxuICBzaGFwZXMuZm9yRWFjaChzYyA9PiB7XG4gICAgaWYgKCFoYXNoZXNJbkRvbVtzYy5oYXNoXSkgcm9vdC5hcHBlbmRDaGlsZChyZW5kZXJTaGFwZShzdGF0ZSwgc2MsIGJydXNoZXMsIGFycm93RGVzdHMsIGJvdW5kcykpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gc2hhcGVIYXNoKHtvcmlnLCBkZXN0LCBicnVzaCwgcGllY2UsIG1vZGlmaWVyc306IERyYXdTaGFwZSwgYXJyb3dEZXN0czogQXJyb3dEZXN0cywgY3VycmVudDogYm9vbGVhbik6IEhhc2gge1xuICByZXR1cm4gW2N1cnJlbnQsIG9yaWcsIGRlc3QsIGJydXNoLCBkZXN0ICYmIGFycm93RGVzdHNbZGVzdF0gPiAxLFxuICAgIHBpZWNlICYmIHBpZWNlSGFzaChwaWVjZSksXG4gICAgbW9kaWZpZXJzICYmIG1vZGlmaWVyc0hhc2gobW9kaWZpZXJzKVxuICBdLmZpbHRlcih4ID0+IHgpLmpvaW4oJycpO1xufVxuXG5mdW5jdGlvbiBwaWVjZUhhc2gocGllY2U6IERyYXdTaGFwZVBpZWNlKTogSGFzaCB7XG4gIHJldHVybiBbcGllY2UuY29sb3IsIHBpZWNlLnJvbGUsIHBpZWNlLnNjYWxlXS5maWx0ZXIoeCA9PiB4KS5qb2luKCcnKTtcbn1cblxuZnVuY3Rpb24gbW9kaWZpZXJzSGFzaChtOiBEcmF3TW9kaWZpZXJzKTogSGFzaCB7XG4gIHJldHVybiAnJyArIChtLmxpbmVXaWR0aCB8fCAnJyk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclNoYXBlKHN0YXRlOiBTdGF0ZSwge3NoYXBlLCBjdXJyZW50LCBoYXNofTogU2hhcGUsIGJydXNoZXM6IERyYXdCcnVzaGVzLCBhcnJvd0Rlc3RzOiBBcnJvd0Rlc3RzLCBib3VuZHM6IENsaWVudFJlY3QpOiBTVkdFbGVtZW50IHtcbiAgY29uc3QgZmlyc3RSYW5rSXMwID0gc3RhdGUuZGltZW5zaW9ucy5oZWlnaHQgPT09IDEwO1xuICBsZXQgZWw6IFNWR0VsZW1lbnQ7XG4gIGlmIChzaGFwZS5waWVjZSkgZWwgPSByZW5kZXJQaWVjZShcbiAgICBzdGF0ZS5kcmF3YWJsZS5waWVjZXMuYmFzZVVybCxcbiAgICBvcmllbnQoa2V5MnBvcyhzaGFwZS5vcmlnLCBmaXJzdFJhbmtJczApLCBzdGF0ZS5vcmllbnRhdGlvbiwgc3RhdGUuZGltZW5zaW9ucyksXG4gICAgc2hhcGUucGllY2UsXG4gICAgYm91bmRzLFxuICAgIHN0YXRlLmRpbWVuc2lvbnMpO1xuICBlbHNlIHtcbiAgICBjb25zdCBvcmlnID0gb3JpZW50KGtleTJwb3Moc2hhcGUub3JpZywgZmlyc3RSYW5rSXMwKSwgc3RhdGUub3JpZW50YXRpb24sIHN0YXRlLmRpbWVuc2lvbnMpO1xuICAgIGlmIChzaGFwZS5vcmlnICYmIHNoYXBlLmRlc3QpIHtcbiAgICAgIGxldCBicnVzaDogRHJhd0JydXNoID0gYnJ1c2hlc1tzaGFwZS5icnVzaF07XG4gICAgICBpZiAoc2hhcGUubW9kaWZpZXJzKSBicnVzaCA9IG1ha2VDdXN0b21CcnVzaChicnVzaCwgc2hhcGUubW9kaWZpZXJzKTtcbiAgICAgIGVsID0gcmVuZGVyQXJyb3coXG4gICAgICAgIGJydXNoLFxuICAgICAgICBvcmlnLFxuICAgICAgICBvcmllbnQoa2V5MnBvcyhzaGFwZS5kZXN0LCBmaXJzdFJhbmtJczApLCBzdGF0ZS5vcmllbnRhdGlvbiwgc3RhdGUuZGltZW5zaW9ucyksXG4gICAgICAgIGN1cnJlbnQsXG4gICAgICAgIGFycm93RGVzdHNbc2hhcGUuZGVzdF0gPiAxLFxuICAgICAgICBib3VuZHMsXG4gICAgICAgIHN0YXRlLmRpbWVuc2lvbnMpO1xuICAgIH1cbiAgICBlbHNlIGVsID0gcmVuZGVyQ2lyY2xlKGJydXNoZXNbc2hhcGUuYnJ1c2hdLCBvcmlnLCBjdXJyZW50LCBib3VuZHMsIHN0YXRlLmRpbWVuc2lvbnMpO1xuICB9XG4gIGVsLnNldEF0dHJpYnV0ZSgnY2dIYXNoJywgaGFzaCk7XG4gIHJldHVybiBlbDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyQ2lyY2xlKGJydXNoOiBEcmF3QnJ1c2gsIHBvczogY2cuUG9zLCBjdXJyZW50OiBib29sZWFuLCBib3VuZHM6IENsaWVudFJlY3QsIGJkOiBjZy5Cb2FyZERpbWVuc2lvbnMpOiBTVkdFbGVtZW50IHtcbiAgY29uc3QgbyA9IHBvczJweChwb3MsIGJvdW5kcywgYmQpLFxuICB3aWR0aHMgPSBjaXJjbGVXaWR0aChib3VuZHMsIGJkKSxcbiAgcmFkaXVzID0gKGJvdW5kcy53aWR0aCAvIGJkLndpZHRoKSAvIDI7XG4gIHJldHVybiBzZXRBdHRyaWJ1dGVzKGNyZWF0ZUVsZW1lbnQoJ2NpcmNsZScpLCB7XG4gICAgc3Ryb2tlOiBicnVzaC5jb2xvcixcbiAgICAnc3Ryb2tlLXdpZHRoJzogd2lkdGhzW2N1cnJlbnQgPyAwIDogMV0sXG4gICAgZmlsbDogJ25vbmUnLFxuICAgIG9wYWNpdHk6IG9wYWNpdHkoYnJ1c2gsIGN1cnJlbnQpLFxuICAgIGN4OiBvWzBdLFxuICAgIGN5OiBvWzFdLFxuICAgIHI6IHJhZGl1cyAtIHdpZHRoc1sxXSAvIDJcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckFycm93KGJydXNoOiBEcmF3QnJ1c2gsIG9yaWc6IGNnLlBvcywgZGVzdDogY2cuUG9zLCBjdXJyZW50OiBib29sZWFuLCBzaG9ydGVuOiBib29sZWFuLCBib3VuZHM6IENsaWVudFJlY3QsIGJkOiBjZy5Cb2FyZERpbWVuc2lvbnMpOiBTVkdFbGVtZW50IHtcbiAgY29uc3QgbSA9IGFycm93TWFyZ2luKGJvdW5kcywgc2hvcnRlbiAmJiAhY3VycmVudCwgYmQpLFxuICBhID0gcG9zMnB4KG9yaWcsIGJvdW5kcywgYmQpLFxuICBiID0gcG9zMnB4KGRlc3QsIGJvdW5kcywgYmQpLFxuICBkeCA9IGJbMF0gLSBhWzBdLFxuICBkeSA9IGJbMV0gLSBhWzFdLFxuICBhbmdsZSA9IE1hdGguYXRhbjIoZHksIGR4KSxcbiAgeG8gPSBNYXRoLmNvcyhhbmdsZSkgKiBtLFxuICB5byA9IE1hdGguc2luKGFuZ2xlKSAqIG07XG4gIHJldHVybiBzZXRBdHRyaWJ1dGVzKGNyZWF0ZUVsZW1lbnQoJ2xpbmUnKSwge1xuICAgIHN0cm9rZTogYnJ1c2guY29sb3IsXG4gICAgJ3N0cm9rZS13aWR0aCc6IGxpbmVXaWR0aChicnVzaCwgY3VycmVudCwgYm91bmRzLCBiZCksXG4gICAgJ3N0cm9rZS1saW5lY2FwJzogJ3JvdW5kJyxcbiAgICAnbWFya2VyLWVuZCc6ICd1cmwoI2Fycm93aGVhZC0nICsgYnJ1c2gua2V5ICsgJyknLFxuICAgIG9wYWNpdHk6IG9wYWNpdHkoYnJ1c2gsIGN1cnJlbnQpLFxuICAgIHgxOiBhWzBdLFxuICAgIHkxOiBhWzFdLFxuICAgIHgyOiBiWzBdIC0geG8sXG4gICAgeTI6IGJbMV0gLSB5b1xuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyUGllY2UoYmFzZVVybDogc3RyaW5nLCBwb3M6IGNnLlBvcywgcGllY2U6IERyYXdTaGFwZVBpZWNlLCBib3VuZHM6IENsaWVudFJlY3QsIGJkOiBjZy5Cb2FyZERpbWVuc2lvbnMpOiBTVkdFbGVtZW50IHtcbiAgY29uc3QgbyA9IHBvczJweChwb3MsIGJvdW5kcywgYmQpLFxuICB3aWR0aCA9IGJvdW5kcy53aWR0aCAvIGJkLndpZHRoICogKHBpZWNlLnNjYWxlIHx8IDEpLFxuICBoZWlnaHQgPSBib3VuZHMud2lkdGggLyBiZC5oZWlnaHQgKiAocGllY2Uuc2NhbGUgfHwgMSksXG4gIG5hbWUgPSBwaWVjZS5jb2xvclswXSArIChwaWVjZS5yb2xlID09PSAna25pZ2h0JyA/ICduJyA6IHBpZWNlLnJvbGVbMF0pLnRvVXBwZXJDYXNlKCk7XG4gIHJldHVybiBzZXRBdHRyaWJ1dGVzKGNyZWF0ZUVsZW1lbnQoJ2ltYWdlJyksIHtcbiAgICBjbGFzc05hbWU6IGAke3BpZWNlLnJvbGV9ICR7cGllY2UuY29sb3J9YCxcbiAgICB4OiBvWzBdIC0gd2lkdGggLyAyLFxuICAgIHk6IG9bMV0gLSBoZWlnaHQgLyAyLFxuICAgIHdpZHRoOiB3aWR0aCxcbiAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICBocmVmOiBiYXNlVXJsICsgbmFtZSArICcuc3ZnJ1xuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyTWFya2VyKGJydXNoOiBEcmF3QnJ1c2gpOiBTVkdFbGVtZW50IHtcbiAgY29uc3QgbWFya2VyID0gc2V0QXR0cmlidXRlcyhjcmVhdGVFbGVtZW50KCdtYXJrZXInKSwge1xuICAgIGlkOiAnYXJyb3doZWFkLScgKyBicnVzaC5rZXksXG4gICAgb3JpZW50OiAnYXV0bycsXG4gICAgbWFya2VyV2lkdGg6IDQsXG4gICAgbWFya2VySGVpZ2h0OiA4LFxuICAgIHJlZlg6IDIuMDUsXG4gICAgcmVmWTogMi4wMVxuICB9KTtcbiAgbWFya2VyLmFwcGVuZENoaWxkKHNldEF0dHJpYnV0ZXMoY3JlYXRlRWxlbWVudCgncGF0aCcpLCB7XG4gICAgZDogJ00wLDAgVjQgTDMsMiBaJyxcbiAgICBmaWxsOiBicnVzaC5jb2xvclxuICB9KSk7XG4gIG1hcmtlci5zZXRBdHRyaWJ1dGUoJ2NnS2V5JywgYnJ1c2gua2V5KTtcbiAgcmV0dXJuIG1hcmtlcjtcbn1cblxuZnVuY3Rpb24gc2V0QXR0cmlidXRlcyhlbDogU1ZHRWxlbWVudCwgYXR0cnM6IHsgW2tleTogc3RyaW5nXTogYW55IH0pOiBTVkdFbGVtZW50IHtcbiAgZm9yIChsZXQga2V5IGluIGF0dHJzKSBlbC5zZXRBdHRyaWJ1dGUoa2V5LCBhdHRyc1trZXldKTtcbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiBvcmllbnQocG9zOiBjZy5Qb3MsIGNvbG9yOiBjZy5Db2xvciwgYmQ6IGNnLkJvYXJkRGltZW5zaW9ucyk6IGNnLlBvcyB7XG4gIHJldHVybiBjb2xvciA9PT0gJ3doaXRlJyA/IHBvcyA6IFtiZC53aWR0aCArIDEgLSBwb3NbMF0sIGJkLmhlaWdodCArIDEgLSBwb3NbMV1dO1xufVxuXG5mdW5jdGlvbiBtYWtlQ3VzdG9tQnJ1c2goYmFzZTogRHJhd0JydXNoLCBtb2RpZmllcnM6IERyYXdNb2RpZmllcnMpOiBEcmF3QnJ1c2gge1xuICBjb25zdCBicnVzaDogUGFydGlhbDxEcmF3QnJ1c2g+ID0ge1xuICAgIGNvbG9yOiBiYXNlLmNvbG9yLFxuICAgIG9wYWNpdHk6IE1hdGgucm91bmQoYmFzZS5vcGFjaXR5ICogMTApIC8gMTAsXG4gICAgbGluZVdpZHRoOiBNYXRoLnJvdW5kKG1vZGlmaWVycy5saW5lV2lkdGggfHwgYmFzZS5saW5lV2lkdGgpXG4gIH07XG4gIGJydXNoLmtleSA9IFtiYXNlLmtleSwgbW9kaWZpZXJzLmxpbmVXaWR0aF0uZmlsdGVyKHggPT4geCkuam9pbignJyk7XG4gIHJldHVybiBicnVzaCBhcyBEcmF3QnJ1c2g7XG59XG5cbmZ1bmN0aW9uIGNpcmNsZVdpZHRoKGJvdW5kczogQ2xpZW50UmVjdCwgYmQ6IGNnLkJvYXJkRGltZW5zaW9ucyk6IFtudW1iZXIsIG51bWJlcl0ge1xuICBjb25zdCBiYXNlID0gYm91bmRzLndpZHRoIC8gKGJkLndpZHRoICogNjQpO1xuICByZXR1cm4gWzMgKiBiYXNlLCA0ICogYmFzZV07XG59XG5cbmZ1bmN0aW9uIGxpbmVXaWR0aChicnVzaDogRHJhd0JydXNoLCBjdXJyZW50OiBib29sZWFuLCBib3VuZHM6IENsaWVudFJlY3QsIGJkOiBjZy5Cb2FyZERpbWVuc2lvbnMpOiBudW1iZXIge1xuICByZXR1cm4gKGJydXNoLmxpbmVXaWR0aCB8fCAxMCkgKiAoY3VycmVudCA/IDAuODUgOiAxKSAvIChiZC53aWR0aCAqIDY0KSAqIGJvdW5kcy53aWR0aDtcbn1cblxuZnVuY3Rpb24gb3BhY2l0eShicnVzaDogRHJhd0JydXNoLCBjdXJyZW50OiBib29sZWFuKTogbnVtYmVyIHtcbiAgcmV0dXJuIChicnVzaC5vcGFjaXR5IHx8IDEpICogKGN1cnJlbnQgPyAwLjkgOiAxKTtcbn1cblxuZnVuY3Rpb24gYXJyb3dNYXJnaW4oYm91bmRzOiBDbGllbnRSZWN0LCBzaG9ydGVuOiBib29sZWFuLCBiZDogY2cuQm9hcmREaW1lbnNpb25zKTogbnVtYmVyIHtcbiAgcmV0dXJuIChzaG9ydGVuID8gMjAgOiAxMCkgLyAoYmQud2lkdGggKiA2NCkgKiBib3VuZHMud2lkdGg7XG59XG5cbmZ1bmN0aW9uIHBvczJweChwb3M6IGNnLlBvcywgYm91bmRzOiBDbGllbnRSZWN0LCBiZDogY2cuQm9hcmREaW1lbnNpb25zKTogY2cuTnVtYmVyUGFpciB7XG4gIHJldHVybiBbKHBvc1swXSAtIDAuNSkgKiBib3VuZHMud2lkdGggLyBiZC53aWR0aCwgKGJkLmhlaWdodCArIDAuNSAtIHBvc1sxXSkgKiBib3VuZHMuaGVpZ2h0IC8gYmQuaGVpZ2h0XTtcbn1cbiIsImV4cG9ydCB0eXBlIENvbG9yID0gJ3doaXRlJyB8ICdibGFjayc7XG5leHBvcnQgdHlwZSBSb2xlID0gJ2tpbmcnIHwgJ3F1ZWVuJyB8ICdyb29rJyB8ICdiaXNob3AnIHwgJ2tuaWdodCcgfCAncGF3bicgfCAnY2FuY2VsbG9yJyB8ICdhcmNoYmlzaG9wJyB8ICdmZXJ6JyB8ICdtZXQnIHwgJ2dvbGQnIHwgJ3NpbHZlcicgfCAnbGFuY2UnfCAncHBhd24nIHwgJ3BrbmlnaHQnIHwgJ3BiaXNob3AnIHwgJ3Byb29rJyB8ICdwc2lsdmVyJyB8ICdwbGFuY2UnIHwgJ2Fkdmlzb3InIHwgJ2Nhbm5vbicgfCAnaGF3aycgfCAnZWxlcGhhbnQnO1xuZXhwb3J0IHR5cGUgS2V5ID0gICdhMCcgfCAnYjAnIHwgJ2MwJyB8ICdkMCcgfCAnZTAnIHwgJ2YwJyB8ICdnMCcgfCAnaDAnIHwgJ2kwJyB8ICdqMCcgfCAnYTEnIHwgJ2IxJyB8ICdjMScgfCAnZDEnIHwgJ2UxJyB8ICdmMScgfCAnZzEnIHwgJ2gxJyB8ICdpMScgfCAnajEnIHwgJ2EyJyB8ICdiMicgfCAnYzInIHwgJ2QyJyB8ICdlMicgfCAnZjInIHwgJ2cyJyB8ICdoMicgfCAnaTInIHwgJ2oyJyB8ICdhMycgfCAnYjMnIHwgJ2MzJyB8ICdkMycgfCAnZTMnIHwgJ2YzJyB8ICdnMycgfCAnaDMnIHwgJ2kzJyB8ICdqMycgfCAnYTQnIHwgJ2I0JyB8ICdjNCcgfCAnZDQnIHwgJ2U0JyB8ICdmNCcgfCAnZzQnIHwgJ2g0JyB8ICdpNCcgfCAnajQnIHwgJ2E1JyB8ICdiNScgfCAnYzUnIHwgJ2Q1JyB8ICdlNScgfCAnZjUnIHwgJ2c1JyB8ICdoNScgfCAnaTUnIHwgJ2o1JyB8ICdhNicgfCAnYjYnIHwgJ2M2JyB8ICdkNicgfCAnZTYnIHwgJ2Y2JyB8ICdnNicgfCAnaDYnIHwgJ2k2JyB8ICdqNicgfCAnYTcnIHwgJ2I3JyB8ICdjNycgfCAnZDcnIHwgJ2U3JyB8ICdmNycgfCAnZzcnIHwgJ2g3JyB8ICdpNycgfCAnajcnIHwgJ2E4JyB8ICdiOCcgfCAnYzgnIHwgJ2Q4JyB8ICdlOCcgfCAnZjgnIHwgJ2c4JyB8ICdoOCcgfCAnaTgnIHwgJ2o4JyB8ICdhOScgfCAnYjknIHwgJ2M5JyB8ICdkOScgfCAnZTknIHwgJ2Y5JyB8ICdnOScgfCAnaDknIHwgJ2k5JyB8ICdqOSc7XG5leHBvcnQgdHlwZSBGaWxlID0gJ2EnIHwgJ2InIHwgJ2MnIHwgJ2QnIHwgJ2UnIHwgJ2YnIHwgJ2cnIHwgJ2gnIHwgJ2knIHwgJ2onO1xuZXhwb3J0IHR5cGUgUmFuayA9ICcwJyB8ICcxJyB8ICcyJyB8ICczJyB8ICc0JyB8ICc1JyB8ICc2JyB8ICc3JyB8ICc4JyB8ICc5JztcbmV4cG9ydCB0eXBlIEZFTiA9IHN0cmluZztcbmV4cG9ydCB0eXBlIFBvcyA9IFtudW1iZXIsIG51bWJlcl07XG5leHBvcnQgaW50ZXJmYWNlIFBpZWNlIHtcbiAgcm9sZTogUm9sZTtcbiAgY29sb3I6IENvbG9yO1xuICBwcm9tb3RlZD86IGJvb2xlYW47XG59XG5leHBvcnQgaW50ZXJmYWNlIERyb3Age1xuICByb2xlOiBSb2xlO1xuICBrZXk6IEtleTtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgUGllY2VzIHtcbiAgW2tleTogc3RyaW5nXTogUGllY2UgfCB1bmRlZmluZWQ7XG59XG5leHBvcnQgaW50ZXJmYWNlIFBpZWNlc0RpZmYge1xuICBba2V5OiBzdHJpbmddOiBQaWVjZSB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IHR5cGUgS2V5UGFpciA9IFtLZXksIEtleV07XG5cbmV4cG9ydCB0eXBlIE51bWJlclBhaXIgPSBbbnVtYmVyLCBudW1iZXJdO1xuXG5leHBvcnQgdHlwZSBOdW1iZXJRdWFkID0gW251bWJlciwgbnVtYmVyLCBudW1iZXIsIG51bWJlcl07XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVzdHMge1xuICBba2V5OiBzdHJpbmddOiBLZXlbXVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVsZW1lbnRzIHtcbiAgYm9hcmQ6IEhUTUxFbGVtZW50O1xuICBjb250YWluZXI6IEhUTUxFbGVtZW50O1xuICBnaG9zdD86IEhUTUxFbGVtZW50O1xuICBzdmc/OiBTVkdFbGVtZW50O1xufVxuZXhwb3J0IGludGVyZmFjZSBEb20ge1xuICBlbGVtZW50czogRWxlbWVudHMsXG4gIGJvdW5kczogTWVtbzxDbGllbnRSZWN0PjtcbiAgcmVkcmF3OiAoKSA9PiB2b2lkO1xuICByZWRyYXdOb3c6IChza2lwU3ZnPzogYm9vbGVhbikgPT4gdm9pZDtcbiAgdW5iaW5kPzogVW5iaW5kO1xuICBkZXN0cm95ZWQ/OiBib29sZWFuO1xuICByZWxhdGl2ZT86IGJvb2xlYW47IC8vIGRvbid0IGNvbXB1dGUgYm91bmRzLCB1c2UgcmVsYXRpdmUgJSB0byBwbGFjZSBwaWVjZXNcbn1cbmV4cG9ydCBpbnRlcmZhY2UgRXhwbG9kaW5nIHtcbiAgc3RhZ2U6IG51bWJlcjtcbiAga2V5czogS2V5W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTW92ZU1ldGFkYXRhIHtcbiAgcHJlbW92ZTogYm9vbGVhbjtcbiAgY3RybEtleT86IGJvb2xlYW47XG4gIGhvbGRUaW1lPzogbnVtYmVyO1xuICBjYXB0dXJlZD86IFBpZWNlO1xuICBwcmVkcm9wPzogYm9vbGVhbjtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgU2V0UHJlbW92ZU1ldGFkYXRhIHtcbiAgY3RybEtleT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIFdpbmRvd0V2ZW50ID0gJ29uc2Nyb2xsJyB8ICdvbnJlc2l6ZSc7XG5cbmV4cG9ydCB0eXBlIE1vdWNoRXZlbnQgPSBNb3VzZUV2ZW50ICYgVG91Y2hFdmVudDtcblxuZXhwb3J0IGludGVyZmFjZSBLZXllZE5vZGUgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gIGNnS2V5OiBLZXk7XG59XG5leHBvcnQgaW50ZXJmYWNlIFBpZWNlTm9kZSBleHRlbmRzIEtleWVkTm9kZSB7XG4gIGNnUGllY2U6IHN0cmluZztcbiAgY2dBbmltYXRpbmc/OiBib29sZWFuO1xuICBjZ0ZhZGluZz86IGJvb2xlYW47XG4gIGNnRHJhZ2dpbmc/OiBib29sZWFuO1xufVxuZXhwb3J0IGludGVyZmFjZSBTcXVhcmVOb2RlIGV4dGVuZHMgS2V5ZWROb2RlIHsgfVxuXG5leHBvcnQgaW50ZXJmYWNlIE1lbW88QT4geyAoKTogQTsgY2xlYXI6ICgpID0+IHZvaWQ7IH1cblxuZXhwb3J0IGludGVyZmFjZSBUaW1lciB7XG4gIHN0YXJ0OiAoKSA9PiB2b2lkO1xuICBjYW5jZWw6ICgpID0+IHZvaWQ7XG4gIHN0b3A6ICgpID0+IG51bWJlcjtcbn1cblxuZXhwb3J0IHR5cGUgUmVkcmF3ID0gKCkgPT4gdm9pZDtcbmV4cG9ydCB0eXBlIFVuYmluZCA9ICgpID0+IHZvaWQ7XG5leHBvcnQgdHlwZSBNaWxsaXNlY29uZHMgPSBudW1iZXI7XG5leHBvcnQgdHlwZSBLSHogPSBudW1iZXI7XG5cbmV4cG9ydCBjb25zdCBmaWxlczogRmlsZVtdID0gWydhJywgJ2InLCAnYycsICdkJywgJ2UnLCAnZicsICdnJywgJ2gnLCAnaScsICdqJ107XG5leHBvcnQgY29uc3QgcmFua3M6IFJhbmtbXSA9IFsnMCcsICcxJywgJzInLCAnMycsICc0JywgJzUnLCAnNicsICc3JywgJzgnLCAnOSddO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJvYXJkRGltZW5zaW9ucyB7XG4gIHdpZHRoOiBudW1iZXI7XG4gIGhlaWdodDogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBHZW9tZXRyeSB7ZGltOHg4LCBkaW05eDksIGRpbTEweDgsIGRpbTl4MTB9O1xuXG5leHBvcnQgY29uc3QgZGltZW5zaW9uczogQm9hcmREaW1lbnNpb25zW10gPSBbe3dpZHRoOiA4LCBoZWlnaHQ6IDh9LCB7d2lkdGg6IDksIGhlaWdodDogOX0sIHt3aWR0aDogMTAsIGhlaWdodDogOH0sIHt3aWR0aDogOSwgaGVpZ2h0OiAxMH1dO1xuIiwiaW1wb3J0ICogYXMgY2cgZnJvbSAnLi90eXBlcyc7XG5cbmV4cG9ydCBjb25zdCBjb2xvcnM6IGNnLkNvbG9yW10gPSBbJ3doaXRlJywgJ2JsYWNrJ107XG5cbmV4cG9ydCBjb25zdCBOUmFua3M6IG51bWJlcltdID0gWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwXTtcbmV4cG9ydCBjb25zdCBpbnZOUmFua3M6IG51bWJlcltdID0gWzEwLCA5LCA4LCA3LCA2LCA1LCA0LCAzLCAyLCAxXTtcblxuY29uc3QgZmlsZXM4ID0gY2cuZmlsZXMuc2xpY2UoMCwgOCk7XG5jb25zdCBmaWxlczkgPSBjZy5maWxlcy5zbGljZSgwLCA5KTtcbmNvbnN0IGZpbGVzMTAgPSBjZy5maWxlcy5zbGljZSgwLCAxMCk7XG5cbmNvbnN0IHJhbmtzOCA9IGNnLnJhbmtzLnNsaWNlKDEsIDkpO1xuY29uc3QgcmFua3M5ID0gY2cucmFua3Muc2xpY2UoMSwgMTApO1xuLy8gd2UgaGF2ZSB0byBjb3VudCByYW5rcyBzdGFydGluZyBmcm9tIDAgYXMgaW4gVUNDSVxuY29uc3QgcmFua3MxMCA9IGNnLnJhbmtzLnNsaWNlKDAsIDEwKTtcblxuY29uc3QgYWxsS2V5czh4ODogY2cuS2V5W10gPSBBcnJheS5wcm90b3R5cGUuY29uY2F0KC4uLmZpbGVzOC5tYXAoYyA9PiByYW5rczgubWFwKHIgPT4gYytyKSkpO1xuY29uc3QgYWxsS2V5czl4OTogY2cuS2V5W10gPSBBcnJheS5wcm90b3R5cGUuY29uY2F0KC4uLmZpbGVzOS5tYXAoYyA9PiByYW5rczkubWFwKHIgPT4gYytyKSkpO1xuY29uc3QgYWxsS2V5czEweDg6IGNnLktleVtdID0gQXJyYXkucHJvdG90eXBlLmNvbmNhdCguLi5maWxlczEwLm1hcChjID0+IHJhbmtzOC5tYXAociA9PiBjK3IpKSk7XG5jb25zdCBhbGxLZXlzOXgxMDogY2cuS2V5W10gPSBBcnJheS5wcm90b3R5cGUuY29uY2F0KC4uLmZpbGVzOS5tYXAoYyA9PiByYW5rczEwLm1hcChyID0+IGMrcikpKTtcblxuZXhwb3J0IGNvbnN0IGFsbEtleXMgPSBbYWxsS2V5czh4OCwgYWxsS2V5czl4OSwgYWxsS2V5czEweDgsIGFsbEtleXM5eDEwXTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBvczJrZXkocG9zOiBjZy5Qb3MsIGdlb206IGNnLkdlb21ldHJ5KSB7XG4gICAgY29uc3QgYmQgPSBjZy5kaW1lbnNpb25zW2dlb21dO1xuICAgIHJldHVybiBhbGxLZXlzW2dlb21dW2JkLmhlaWdodCAqIHBvc1swXSArIHBvc1sxXSAtIGJkLmhlaWdodCAtIDFdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24ga2V5MnBvcyhrOiBjZy5LZXksIGZpcnN0UmFua0lzMDogYm9vbGVhbikge1xuICBjb25zdCBzaGlmdCA9IGZpcnN0UmFua0lzMCA/IDEgOiAwO1xuICByZXR1cm4gW2suY2hhckNvZGVBdCgwKSAtIDk2LCBrLmNoYXJDb2RlQXQoMSkgLSA0OCArIHNoaWZ0XSBhcyBjZy5Qb3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtZW1vPEE+KGY6ICgpID0+IEEpOiBjZy5NZW1vPEE+IHtcbiAgbGV0IHY6IEEgfCB1bmRlZmluZWQ7XG4gIGNvbnN0IHJldDogYW55ID0gKCkgPT4ge1xuICAgIGlmICh2ID09PSB1bmRlZmluZWQpIHYgPSBmKCk7XG4gICAgcmV0dXJuIHY7XG4gIH07XG4gIHJldC5jbGVhciA9ICgpID0+IHsgdiA9IHVuZGVmaW5lZCB9O1xuICByZXR1cm4gcmV0O1xufVxuXG5leHBvcnQgY29uc3QgdGltZXI6ICgpID0+IGNnLlRpbWVyID0gKCkgPT4ge1xuICBsZXQgc3RhcnRBdDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuICByZXR1cm4ge1xuICAgIHN0YXJ0KCkgeyBzdGFydEF0ID0gcGVyZm9ybWFuY2Uubm93KCkgfSxcbiAgICBjYW5jZWwoKSB7IHN0YXJ0QXQgPSB1bmRlZmluZWQgfSxcbiAgICBzdG9wKCkge1xuICAgICAgaWYgKCFzdGFydEF0KSByZXR1cm4gMDtcbiAgICAgIGNvbnN0IHRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKSAtIHN0YXJ0QXQ7XG4gICAgICBzdGFydEF0ID0gdW5kZWZpbmVkO1xuICAgICAgcmV0dXJuIHRpbWU7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgY29uc3Qgb3Bwb3NpdGUgPSAoYzogY2cuQ29sb3IpID0+IGMgPT09ICd3aGl0ZScgPyAnYmxhY2snIDogJ3doaXRlJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbnRhaW5zWDxYPih4czogWFtdIHwgdW5kZWZpbmVkLCB4OiBYKTogYm9vbGVhbiB7XG4gIHJldHVybiB4cyAhPT0gdW5kZWZpbmVkICYmIHhzLmluZGV4T2YoeCkgIT09IC0xO1xufVxuXG5leHBvcnQgY29uc3QgZGlzdGFuY2VTcTogKHBvczE6IGNnLlBvcywgcG9zMjogY2cuUG9zKSA9PiBudW1iZXIgPSAocG9zMSwgcG9zMikgPT4ge1xuICByZXR1cm4gTWF0aC5wb3cocG9zMVswXSAtIHBvczJbMF0sIDIpICsgTWF0aC5wb3cocG9zMVsxXSAtIHBvczJbMV0sIDIpO1xufVxuXG5leHBvcnQgY29uc3Qgc2FtZVBpZWNlOiAocDE6IGNnLlBpZWNlLCBwMjogY2cuUGllY2UpID0+IGJvb2xlYW4gPSAocDEsIHAyKSA9PlxuICBwMS5yb2xlID09PSBwMi5yb2xlICYmIHAxLmNvbG9yID09PSBwMi5jb2xvcjtcblxuY29uc3QgcG9zVG9UcmFuc2xhdGVCYXNlOiAocG9zOiBjZy5Qb3MsIGFzV2hpdGU6IGJvb2xlYW4sIHhGYWN0b3I6IG51bWJlciwgeUZhY3RvcjogbnVtYmVyLCBidDogY2cuQm9hcmREaW1lbnNpb25zKSA9PiBjZy5OdW1iZXJQYWlyID1cbihwb3MsIGFzV2hpdGUsIHhGYWN0b3IsIHlGYWN0b3IsIGJ0KSA9PiBbXG4gIChhc1doaXRlID8gcG9zWzBdIC0gMSA6IGJ0LndpZHRoIC0gcG9zWzBdKSAqIHhGYWN0b3IsXG4gIChhc1doaXRlID8gYnQuaGVpZ2h0IC0gcG9zWzFdIDogcG9zWzFdIC0gMSkgKiB5RmFjdG9yXG5dO1xuXG5leHBvcnQgY29uc3QgcG9zVG9UcmFuc2xhdGVBYnMgPSAoYm91bmRzOiBDbGllbnRSZWN0LCBidDogY2cuQm9hcmREaW1lbnNpb25zKSA9PiB7XG4gIGNvbnN0IHhGYWN0b3IgPSBib3VuZHMud2lkdGggLyBidC53aWR0aCxcbiAgeUZhY3RvciA9IGJvdW5kcy5oZWlnaHQgLyBidC5oZWlnaHQ7XG4gIHJldHVybiAocG9zOiBjZy5Qb3MsIGFzV2hpdGU6IGJvb2xlYW4pID0+IHBvc1RvVHJhbnNsYXRlQmFzZShwb3MsIGFzV2hpdGUsIHhGYWN0b3IsIHlGYWN0b3IsIGJ0KTtcbn07XG5cbmV4cG9ydCBjb25zdCBwb3NUb1RyYW5zbGF0ZVJlbDogKHBvczogY2cuUG9zLCBhc1doaXRlOiBib29sZWFuLCBidDogY2cuQm9hcmREaW1lbnNpb25zKSA9PiBjZy5OdW1iZXJQYWlyID1cbiAgKHBvcywgYXNXaGl0ZSwgYnQpID0+IHBvc1RvVHJhbnNsYXRlQmFzZShwb3MsIGFzV2hpdGUsIDEwMCAvIGJ0LndpZHRoLCAxMDAgLyBidC5oZWlnaHQsIGJ0KTtcblxuZXhwb3J0IGNvbnN0IHRyYW5zbGF0ZUFicyA9IChlbDogSFRNTEVsZW1lbnQsIHBvczogY2cuUG9zKSA9PiB7XG4gIGVsLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGUoJHtwb3NbMF19cHgsJHtwb3NbMV19cHgpYDtcbn1cblxuZXhwb3J0IGNvbnN0IHRyYW5zbGF0ZVJlbCA9IChlbDogSFRNTEVsZW1lbnQsIHBlcmNlbnRzOiBjZy5OdW1iZXJQYWlyKSA9PiB7XG4gIGVsLnN0eWxlLmxlZnQgPSBwZXJjZW50c1swXSArICclJztcbiAgZWwuc3R5bGUudG9wID0gcGVyY2VudHNbMV0gKyAnJSc7XG59XG5cbmV4cG9ydCBjb25zdCBzZXRWaXNpYmxlID0gKGVsOiBIVE1MRWxlbWVudCwgdjogYm9vbGVhbikgPT4ge1xuICBlbC5zdHlsZS52aXNpYmlsaXR5ID0gdiA/ICd2aXNpYmxlJyA6ICdoaWRkZW4nO1xufVxuXG4vLyB0b3VjaGVuZCBoYXMgbm8gcG9zaXRpb24hXG5leHBvcnQgY29uc3QgZXZlbnRQb3NpdGlvbjogKGU6IGNnLk1vdWNoRXZlbnQpID0+IGNnLk51bWJlclBhaXIgfCB1bmRlZmluZWQgPSBlID0+IHtcbiAgaWYgKGUuY2xpZW50WCB8fCBlLmNsaWVudFggPT09IDApIHJldHVybiBbZS5jbGllbnRYLCBlLmNsaWVudFldO1xuICBpZiAoZS50b3VjaGVzICYmIGUudGFyZ2V0VG91Y2hlc1swXSkgcmV0dXJuIFtlLnRhcmdldFRvdWNoZXNbMF0uY2xpZW50WCwgZS50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFldO1xuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY29uc3QgaXNSaWdodEJ1dHRvbiA9IChlOiBNb3VzZUV2ZW50KSA9PiBlLmJ1dHRvbnMgPT09IDIgfHwgZS5idXR0b24gPT09IDI7XG5cbmV4cG9ydCBjb25zdCBjcmVhdGVFbCA9ICh0YWdOYW1lOiBzdHJpbmcsIGNsYXNzTmFtZT86IHN0cmluZykgPT4ge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG4gIGlmIChjbGFzc05hbWUpIGVsLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcbiAgcmV0dXJuIGVsO1xufVxuIiwiaW1wb3J0IHsgU3RhdGUgfSBmcm9tICcuL3N0YXRlJ1xuaW1wb3J0IHsgY29sb3JzLCBzZXRWaXNpYmxlLCBjcmVhdGVFbCB9IGZyb20gJy4vdXRpbCdcbmltcG9ydCB7IGZpbGVzLCByYW5rcyB9IGZyb20gJy4vdHlwZXMnXG5pbXBvcnQgeyBjcmVhdGVFbGVtZW50IGFzIGNyZWF0ZVNWRyB9IGZyb20gJy4vc3ZnJ1xuaW1wb3J0IHsgRWxlbWVudHMgfSBmcm9tICcuL3R5cGVzJ1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB3cmFwKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBzOiBTdGF0ZSwgcmVsYXRpdmU6IGJvb2xlYW4pOiBFbGVtZW50cyB7XG5cbiAgLy8gLmNnLXdyYXAgKGVsZW1lbnQgcGFzc2VkIHRvIENoZXNzZ3JvdW5kKVxuICAvLyAgIGNnLWhlbHBlciAoMTIuNSUpXG4gIC8vICAgICBjZy1jb250YWluZXIgKDgwMCUpXG4gIC8vICAgICAgIGNnLWJvYXJkXG4gIC8vICAgICAgIHN2Z1xuICAvLyAgICAgICBjb29yZHMucmFua3NcbiAgLy8gICAgICAgY29vcmRzLmZpbGVzXG4gIC8vICAgICAgIHBpZWNlLmdob3N0XG5cbiAgZWxlbWVudC5pbm5lckhUTUwgPSAnJztcblxuICAvLyBlbnN1cmUgdGhlIGNnLXdyYXAgY2xhc3MgaXMgc2V0XG4gIC8vIHNvIGJvdW5kcyBjYWxjdWxhdGlvbiBjYW4gdXNlIHRoZSBDU1Mgd2lkdGgvaGVpZ2h0IHZhbHVlc1xuICAvLyBhZGQgdGhhdCBjbGFzcyB5b3Vyc2VsZiB0byB0aGUgZWxlbWVudCBiZWZvcmUgY2FsbGluZyBjaGVzc2dyb3VuZFxuICAvLyBmb3IgYSBzbGlnaHQgcGVyZm9ybWFuY2UgaW1wcm92ZW1lbnQhIChhdm9pZHMgcmVjb21wdXRpbmcgc3R5bGUpXG4gIGVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnY2ctd3JhcCcpO1xuXG4gIGNvbG9ycy5mb3JFYWNoKGMgPT4gZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdvcmllbnRhdGlvbi0nICsgYywgcy5vcmllbnRhdGlvbiA9PT0gYykpO1xuICBlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ21hbmlwdWxhYmxlJywgIXMudmlld09ubHkpO1xuXG4gIGNvbnN0IGhlbHBlciA9IGNyZWF0ZUVsKCdjZy1oZWxwZXInKTtcbiAgZWxlbWVudC5hcHBlbmRDaGlsZChoZWxwZXIpO1xuICBjb25zdCBjb250YWluZXIgPSBjcmVhdGVFbCgnY2ctY29udGFpbmVyJyk7XG4gIGhlbHBlci5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuXG4gIGNvbnN0IGV4dGVuc2lvbiA9IGNyZWF0ZUVsKCdleHRlbnNpb24nKTtcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKGV4dGVuc2lvbik7XG4gIGNvbnN0IGJvYXJkID0gY3JlYXRlRWwoJ2NnLWJvYXJkJyk7XG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChib2FyZCk7XG5cbiAgbGV0IHN2ZzogU1ZHRWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgaWYgKHMuZHJhd2FibGUudmlzaWJsZSAmJiAhcmVsYXRpdmUpIHtcbiAgICBzdmcgPSBjcmVhdGVTVkcoJ3N2ZycpO1xuICAgIHN2Zy5hcHBlbmRDaGlsZChjcmVhdGVTVkcoJ2RlZnMnKSk7XG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKHN2Zyk7XG4gIH1cblxuICBpZiAocy5jb29yZGluYXRlcykge1xuICAgIGNvbnN0IG9yaWVudENsYXNzID0gcy5vcmllbnRhdGlvbiA9PT0gJ2JsYWNrJyA/ICcgYmxhY2snIDogJyc7XG4gICAgY29uc3QgZmlyc3RSYW5rSXMwID0gcy5kaW1lbnNpb25zLmhlaWdodCA9PT0gMTA7XG4gICAgY29uc3Qgc2hpZnQgPSBmaXJzdFJhbmtJczAgPyAwIDogMTtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQocmVuZGVyQ29vcmRzKHJhbmtzLnNsaWNlKHNoaWZ0LCBzLmRpbWVuc2lvbnMuaGVpZ2h0ICsgc2hpZnQpLCAncmFua3MnICsgb3JpZW50Q2xhc3MpKTtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQocmVuZGVyQ29vcmRzKGZpbGVzLnNsaWNlKDAsIHMuZGltZW5zaW9ucy53aWR0aCksICdmaWxlcycgKyBvcmllbnRDbGFzcykpO1xuICB9XG5cbiAgbGV0IGdob3N0OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgaWYgKHMuZHJhZ2dhYmxlLnNob3dHaG9zdCAmJiAhcmVsYXRpdmUpIHtcbiAgICBnaG9zdCA9IGNyZWF0ZUVsKCdwaWVjZScsICdnaG9zdCcpO1xuICAgIHNldFZpc2libGUoZ2hvc3QsIGZhbHNlKTtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoZ2hvc3QpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBib2FyZCxcbiAgICBjb250YWluZXIsXG4gICAgZ2hvc3QsXG4gICAgc3ZnXG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlbmRlckNvb3JkcyhlbGVtczogYW55W10sIGNsYXNzTmFtZTogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBlbCA9IGNyZWF0ZUVsKCdjb29yZHMnLCBjbGFzc05hbWUpO1xuICBsZXQgZjogSFRNTEVsZW1lbnQ7XG4gIGZvciAobGV0IGkgaW4gZWxlbXMpIHtcbiAgICBmID0gY3JlYXRlRWwoJ2Nvb3JkJyk7XG4gICAgZi50ZXh0Q29udGVudCA9IGVsZW1zW2ldO1xuICAgIGVsLmFwcGVuZENoaWxkKGYpO1xuICB9XG4gIHJldHVybiBlbDtcbn1cbiIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xudmFyIHZub2RlXzEgPSByZXF1aXJlKFwiLi92bm9kZVwiKTtcbnZhciBpcyA9IHJlcXVpcmUoXCIuL2lzXCIpO1xuZnVuY3Rpb24gYWRkTlMoZGF0YSwgY2hpbGRyZW4sIHNlbCkge1xuICAgIGRhdGEubnMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnO1xuICAgIGlmIChzZWwgIT09ICdmb3JlaWduT2JqZWN0JyAmJiBjaGlsZHJlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBjaGlsZERhdGEgPSBjaGlsZHJlbltpXS5kYXRhO1xuICAgICAgICAgICAgaWYgKGNoaWxkRGF0YSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgYWRkTlMoY2hpbGREYXRhLCBjaGlsZHJlbltpXS5jaGlsZHJlbiwgY2hpbGRyZW5baV0uc2VsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbmZ1bmN0aW9uIGgoc2VsLCBiLCBjKSB7XG4gICAgdmFyIGRhdGEgPSB7fSwgY2hpbGRyZW4sIHRleHQsIGk7XG4gICAgaWYgKGMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBkYXRhID0gYjtcbiAgICAgICAgaWYgKGlzLmFycmF5KGMpKSB7XG4gICAgICAgICAgICBjaGlsZHJlbiA9IGM7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaXMucHJpbWl0aXZlKGMpKSB7XG4gICAgICAgICAgICB0ZXh0ID0gYztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChjICYmIGMuc2VsKSB7XG4gICAgICAgICAgICBjaGlsZHJlbiA9IFtjXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChiICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKGlzLmFycmF5KGIpKSB7XG4gICAgICAgICAgICBjaGlsZHJlbiA9IGI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaXMucHJpbWl0aXZlKGIpKSB7XG4gICAgICAgICAgICB0ZXh0ID0gYjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChiICYmIGIuc2VsKSB7XG4gICAgICAgICAgICBjaGlsZHJlbiA9IFtiXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRhdGEgPSBiO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChjaGlsZHJlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgaWYgKGlzLnByaW1pdGl2ZShjaGlsZHJlbltpXSkpXG4gICAgICAgICAgICAgICAgY2hpbGRyZW5baV0gPSB2bm9kZV8xLnZub2RlKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGNoaWxkcmVuW2ldLCB1bmRlZmluZWQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChzZWxbMF0gPT09ICdzJyAmJiBzZWxbMV0gPT09ICd2JyAmJiBzZWxbMl0gPT09ICdnJyAmJlxuICAgICAgICAoc2VsLmxlbmd0aCA9PT0gMyB8fCBzZWxbM10gPT09ICcuJyB8fCBzZWxbM10gPT09ICcjJykpIHtcbiAgICAgICAgYWRkTlMoZGF0YSwgY2hpbGRyZW4sIHNlbCk7XG4gICAgfVxuICAgIHJldHVybiB2bm9kZV8xLnZub2RlKHNlbCwgZGF0YSwgY2hpbGRyZW4sIHRleHQsIHVuZGVmaW5lZCk7XG59XG5leHBvcnRzLmggPSBoO1xuO1xuZXhwb3J0cy5kZWZhdWx0ID0gaDtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWguanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50KHRhZ05hbWUpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2VVUkksIHF1YWxpZmllZE5hbWUpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSwgcXVhbGlmaWVkTmFtZSk7XG59XG5mdW5jdGlvbiBjcmVhdGVUZXh0Tm9kZSh0ZXh0KSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRleHQpO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29tbWVudCh0ZXh0KSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQodGV4dCk7XG59XG5mdW5jdGlvbiBpbnNlcnRCZWZvcmUocGFyZW50Tm9kZSwgbmV3Tm9kZSwgcmVmZXJlbmNlTm9kZSkge1xuICAgIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKG5ld05vZGUsIHJlZmVyZW5jZU5vZGUpO1xufVxuZnVuY3Rpb24gcmVtb3ZlQ2hpbGQobm9kZSwgY2hpbGQpIHtcbiAgICBub2RlLnJlbW92ZUNoaWxkKGNoaWxkKTtcbn1cbmZ1bmN0aW9uIGFwcGVuZENoaWxkKG5vZGUsIGNoaWxkKSB7XG4gICAgbm9kZS5hcHBlbmRDaGlsZChjaGlsZCk7XG59XG5mdW5jdGlvbiBwYXJlbnROb2RlKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS5wYXJlbnROb2RlO1xufVxuZnVuY3Rpb24gbmV4dFNpYmxpbmcobm9kZSkge1xuICAgIHJldHVybiBub2RlLm5leHRTaWJsaW5nO1xufVxuZnVuY3Rpb24gdGFnTmFtZShlbG0pIHtcbiAgICByZXR1cm4gZWxtLnRhZ05hbWU7XG59XG5mdW5jdGlvbiBzZXRUZXh0Q29udGVudChub2RlLCB0ZXh0KSB7XG4gICAgbm9kZS50ZXh0Q29udGVudCA9IHRleHQ7XG59XG5mdW5jdGlvbiBnZXRUZXh0Q29udGVudChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUudGV4dENvbnRlbnQ7XG59XG5mdW5jdGlvbiBpc0VsZW1lbnQobm9kZSkge1xuICAgIHJldHVybiBub2RlLm5vZGVUeXBlID09PSAxO1xufVxuZnVuY3Rpb24gaXNUZXh0KG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS5ub2RlVHlwZSA9PT0gMztcbn1cbmZ1bmN0aW9uIGlzQ29tbWVudChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUubm9kZVR5cGUgPT09IDg7XG59XG5leHBvcnRzLmh0bWxEb21BcGkgPSB7XG4gICAgY3JlYXRlRWxlbWVudDogY3JlYXRlRWxlbWVudCxcbiAgICBjcmVhdGVFbGVtZW50TlM6IGNyZWF0ZUVsZW1lbnROUyxcbiAgICBjcmVhdGVUZXh0Tm9kZTogY3JlYXRlVGV4dE5vZGUsXG4gICAgY3JlYXRlQ29tbWVudDogY3JlYXRlQ29tbWVudCxcbiAgICBpbnNlcnRCZWZvcmU6IGluc2VydEJlZm9yZSxcbiAgICByZW1vdmVDaGlsZDogcmVtb3ZlQ2hpbGQsXG4gICAgYXBwZW5kQ2hpbGQ6IGFwcGVuZENoaWxkLFxuICAgIHBhcmVudE5vZGU6IHBhcmVudE5vZGUsXG4gICAgbmV4dFNpYmxpbmc6IG5leHRTaWJsaW5nLFxuICAgIHRhZ05hbWU6IHRhZ05hbWUsXG4gICAgc2V0VGV4dENvbnRlbnQ6IHNldFRleHRDb250ZW50LFxuICAgIGdldFRleHRDb250ZW50OiBnZXRUZXh0Q29udGVudCxcbiAgICBpc0VsZW1lbnQ6IGlzRWxlbWVudCxcbiAgICBpc1RleHQ6IGlzVGV4dCxcbiAgICBpc0NvbW1lbnQ6IGlzQ29tbWVudCxcbn07XG5leHBvcnRzLmRlZmF1bHQgPSBleHBvcnRzLmh0bWxEb21BcGk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1odG1sZG9tYXBpLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5hcnJheSA9IEFycmF5LmlzQXJyYXk7XG5mdW5jdGlvbiBwcmltaXRpdmUocykge1xuICAgIHJldHVybiB0eXBlb2YgcyA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHMgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5wcmltaXRpdmUgPSBwcmltaXRpdmU7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pcy5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbnZhciB4bGlua05TID0gJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnO1xudmFyIHhtbE5TID0gJ2h0dHA6Ly93d3cudzMub3JnL1hNTC8xOTk4L25hbWVzcGFjZSc7XG52YXIgY29sb25DaGFyID0gNTg7XG52YXIgeENoYXIgPSAxMjA7XG5mdW5jdGlvbiB1cGRhdGVBdHRycyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgICB2YXIga2V5LCBlbG0gPSB2bm9kZS5lbG0sIG9sZEF0dHJzID0gb2xkVm5vZGUuZGF0YS5hdHRycywgYXR0cnMgPSB2bm9kZS5kYXRhLmF0dHJzO1xuICAgIGlmICghb2xkQXR0cnMgJiYgIWF0dHJzKVxuICAgICAgICByZXR1cm47XG4gICAgaWYgKG9sZEF0dHJzID09PSBhdHRycylcbiAgICAgICAgcmV0dXJuO1xuICAgIG9sZEF0dHJzID0gb2xkQXR0cnMgfHwge307XG4gICAgYXR0cnMgPSBhdHRycyB8fCB7fTtcbiAgICAvLyB1cGRhdGUgbW9kaWZpZWQgYXR0cmlidXRlcywgYWRkIG5ldyBhdHRyaWJ1dGVzXG4gICAgZm9yIChrZXkgaW4gYXR0cnMpIHtcbiAgICAgICAgdmFyIGN1ciA9IGF0dHJzW2tleV07XG4gICAgICAgIHZhciBvbGQgPSBvbGRBdHRyc1trZXldO1xuICAgICAgICBpZiAob2xkICE9PSBjdXIpIHtcbiAgICAgICAgICAgIGlmIChjdXIgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlKGtleSwgXCJcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjdXIgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgZWxtLnJlbW92ZUF0dHJpYnV0ZShrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGtleS5jaGFyQ29kZUF0KDApICE9PSB4Q2hhcikge1xuICAgICAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlKGtleSwgY3VyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoa2V5LmNoYXJDb2RlQXQoMykgPT09IGNvbG9uQ2hhcikge1xuICAgICAgICAgICAgICAgICAgICAvLyBBc3N1bWUgeG1sIG5hbWVzcGFjZVxuICAgICAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlTlMoeG1sTlMsIGtleSwgY3VyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoa2V5LmNoYXJDb2RlQXQoNSkgPT09IGNvbG9uQ2hhcikge1xuICAgICAgICAgICAgICAgICAgICAvLyBBc3N1bWUgeGxpbmsgbmFtZXNwYWNlXG4gICAgICAgICAgICAgICAgICAgIGVsbS5zZXRBdHRyaWJ1dGVOUyh4bGlua05TLCBrZXksIGN1cik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlKGtleSwgY3VyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gcmVtb3ZlIHJlbW92ZWQgYXR0cmlidXRlc1xuICAgIC8vIHVzZSBgaW5gIG9wZXJhdG9yIHNpbmNlIHRoZSBwcmV2aW91cyBgZm9yYCBpdGVyYXRpb24gdXNlcyBpdCAoLmkuZS4gYWRkIGV2ZW4gYXR0cmlidXRlcyB3aXRoIHVuZGVmaW5lZCB2YWx1ZSlcbiAgICAvLyB0aGUgb3RoZXIgb3B0aW9uIGlzIHRvIHJlbW92ZSBhbGwgYXR0cmlidXRlcyB3aXRoIHZhbHVlID09IHVuZGVmaW5lZFxuICAgIGZvciAoa2V5IGluIG9sZEF0dHJzKSB7XG4gICAgICAgIGlmICghKGtleSBpbiBhdHRycykpIHtcbiAgICAgICAgICAgIGVsbS5yZW1vdmVBdHRyaWJ1dGUoa2V5KTtcbiAgICAgICAgfVxuICAgIH1cbn1cbmV4cG9ydHMuYXR0cmlidXRlc01vZHVsZSA9IHsgY3JlYXRlOiB1cGRhdGVBdHRycywgdXBkYXRlOiB1cGRhdGVBdHRycyB9O1xuZXhwb3J0cy5kZWZhdWx0ID0gZXhwb3J0cy5hdHRyaWJ1dGVzTW9kdWxlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXR0cmlidXRlcy5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmZ1bmN0aW9uIHVwZGF0ZUNsYXNzKG9sZFZub2RlLCB2bm9kZSkge1xuICAgIHZhciBjdXIsIG5hbWUsIGVsbSA9IHZub2RlLmVsbSwgb2xkQ2xhc3MgPSBvbGRWbm9kZS5kYXRhLmNsYXNzLCBrbGFzcyA9IHZub2RlLmRhdGEuY2xhc3M7XG4gICAgaWYgKCFvbGRDbGFzcyAmJiAha2xhc3MpXG4gICAgICAgIHJldHVybjtcbiAgICBpZiAob2xkQ2xhc3MgPT09IGtsYXNzKVxuICAgICAgICByZXR1cm47XG4gICAgb2xkQ2xhc3MgPSBvbGRDbGFzcyB8fCB7fTtcbiAgICBrbGFzcyA9IGtsYXNzIHx8IHt9O1xuICAgIGZvciAobmFtZSBpbiBvbGRDbGFzcykge1xuICAgICAgICBpZiAoIWtsYXNzW25hbWVdKSB7XG4gICAgICAgICAgICBlbG0uY2xhc3NMaXN0LnJlbW92ZShuYW1lKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKG5hbWUgaW4ga2xhc3MpIHtcbiAgICAgICAgY3VyID0ga2xhc3NbbmFtZV07XG4gICAgICAgIGlmIChjdXIgIT09IG9sZENsYXNzW25hbWVdKSB7XG4gICAgICAgICAgICBlbG0uY2xhc3NMaXN0W2N1ciA/ICdhZGQnIDogJ3JlbW92ZSddKG5hbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuZXhwb3J0cy5jbGFzc01vZHVsZSA9IHsgY3JlYXRlOiB1cGRhdGVDbGFzcywgdXBkYXRlOiB1cGRhdGVDbGFzcyB9O1xuZXhwb3J0cy5kZWZhdWx0ID0gZXhwb3J0cy5jbGFzc01vZHVsZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNsYXNzLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZnVuY3Rpb24gaW52b2tlSGFuZGxlcihoYW5kbGVyLCB2bm9kZSwgZXZlbnQpIHtcbiAgICBpZiAodHlwZW9mIGhhbmRsZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAvLyBjYWxsIGZ1bmN0aW9uIGhhbmRsZXJcbiAgICAgICAgaGFuZGxlci5jYWxsKHZub2RlLCBldmVudCwgdm5vZGUpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAvLyBjYWxsIGhhbmRsZXIgd2l0aCBhcmd1bWVudHNcbiAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyWzBdID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIC8vIHNwZWNpYWwgY2FzZSBmb3Igc2luZ2xlIGFyZ3VtZW50IGZvciBwZXJmb3JtYW5jZVxuICAgICAgICAgICAgaWYgKGhhbmRsZXIubGVuZ3RoID09PSAyKSB7XG4gICAgICAgICAgICAgICAgaGFuZGxlclswXS5jYWxsKHZub2RlLCBoYW5kbGVyWzFdLCBldmVudCwgdm5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBoYW5kbGVyLnNsaWNlKDEpO1xuICAgICAgICAgICAgICAgIGFyZ3MucHVzaChldmVudCk7XG4gICAgICAgICAgICAgICAgYXJncy5wdXNoKHZub2RlKTtcbiAgICAgICAgICAgICAgICBoYW5kbGVyWzBdLmFwcGx5KHZub2RlLCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNhbGwgbXVsdGlwbGUgaGFuZGxlcnNcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaGFuZGxlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGludm9rZUhhbmRsZXIoaGFuZGxlcltpXSwgdm5vZGUsIGV2ZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbmZ1bmN0aW9uIGhhbmRsZUV2ZW50KGV2ZW50LCB2bm9kZSkge1xuICAgIHZhciBuYW1lID0gZXZlbnQudHlwZSwgb24gPSB2bm9kZS5kYXRhLm9uO1xuICAgIC8vIGNhbGwgZXZlbnQgaGFuZGxlcihzKSBpZiBleGlzdHNcbiAgICBpZiAob24gJiYgb25bbmFtZV0pIHtcbiAgICAgICAgaW52b2tlSGFuZGxlcihvbltuYW1lXSwgdm5vZGUsIGV2ZW50KTtcbiAgICB9XG59XG5mdW5jdGlvbiBjcmVhdGVMaXN0ZW5lcigpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gaGFuZGxlcihldmVudCkge1xuICAgICAgICBoYW5kbGVFdmVudChldmVudCwgaGFuZGxlci52bm9kZSk7XG4gICAgfTtcbn1cbmZ1bmN0aW9uIHVwZGF0ZUV2ZW50TGlzdGVuZXJzKG9sZFZub2RlLCB2bm9kZSkge1xuICAgIHZhciBvbGRPbiA9IG9sZFZub2RlLmRhdGEub24sIG9sZExpc3RlbmVyID0gb2xkVm5vZGUubGlzdGVuZXIsIG9sZEVsbSA9IG9sZFZub2RlLmVsbSwgb24gPSB2bm9kZSAmJiB2bm9kZS5kYXRhLm9uLCBlbG0gPSAodm5vZGUgJiYgdm5vZGUuZWxtKSwgbmFtZTtcbiAgICAvLyBvcHRpbWl6YXRpb24gZm9yIHJldXNlZCBpbW11dGFibGUgaGFuZGxlcnNcbiAgICBpZiAob2xkT24gPT09IG9uKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gcmVtb3ZlIGV4aXN0aW5nIGxpc3RlbmVycyB3aGljaCBubyBsb25nZXIgdXNlZFxuICAgIGlmIChvbGRPbiAmJiBvbGRMaXN0ZW5lcikge1xuICAgICAgICAvLyBpZiBlbGVtZW50IGNoYW5nZWQgb3IgZGVsZXRlZCB3ZSByZW1vdmUgYWxsIGV4aXN0aW5nIGxpc3RlbmVycyB1bmNvbmRpdGlvbmFsbHlcbiAgICAgICAgaWYgKCFvbikge1xuICAgICAgICAgICAgZm9yIChuYW1lIGluIG9sZE9uKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVyIGlmIGVsZW1lbnQgd2FzIGNoYW5nZWQgb3IgZXhpc3RpbmcgbGlzdGVuZXJzIHJlbW92ZWRcbiAgICAgICAgICAgICAgICBvbGRFbG0ucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBvbGRMaXN0ZW5lciwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZm9yIChuYW1lIGluIG9sZE9uKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVyIGlmIGV4aXN0aW5nIGxpc3RlbmVyIHJlbW92ZWRcbiAgICAgICAgICAgICAgICBpZiAoIW9uW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIG9sZEVsbS5yZW1vdmVFdmVudExpc3RlbmVyKG5hbWUsIG9sZExpc3RlbmVyLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vIGFkZCBuZXcgbGlzdGVuZXJzIHdoaWNoIGhhcyBub3QgYWxyZWFkeSBhdHRhY2hlZFxuICAgIGlmIChvbikge1xuICAgICAgICAvLyByZXVzZSBleGlzdGluZyBsaXN0ZW5lciBvciBjcmVhdGUgbmV3XG4gICAgICAgIHZhciBsaXN0ZW5lciA9IHZub2RlLmxpc3RlbmVyID0gb2xkVm5vZGUubGlzdGVuZXIgfHwgY3JlYXRlTGlzdGVuZXIoKTtcbiAgICAgICAgLy8gdXBkYXRlIHZub2RlIGZvciBsaXN0ZW5lclxuICAgICAgICBsaXN0ZW5lci52bm9kZSA9IHZub2RlO1xuICAgICAgICAvLyBpZiBlbGVtZW50IGNoYW5nZWQgb3IgYWRkZWQgd2UgYWRkIGFsbCBuZWVkZWQgbGlzdGVuZXJzIHVuY29uZGl0aW9uYWxseVxuICAgICAgICBpZiAoIW9sZE9uKSB7XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gb24pIHtcbiAgICAgICAgICAgICAgICAvLyBhZGQgbGlzdGVuZXIgaWYgZWxlbWVudCB3YXMgY2hhbmdlZCBvciBuZXcgbGlzdGVuZXJzIGFkZGVkXG4gICAgICAgICAgICAgICAgZWxtLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgbGlzdGVuZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGZvciAobmFtZSBpbiBvbikge1xuICAgICAgICAgICAgICAgIC8vIGFkZCBsaXN0ZW5lciBpZiBuZXcgbGlzdGVuZXIgYWRkZWRcbiAgICAgICAgICAgICAgICBpZiAoIW9sZE9uW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsbS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGxpc3RlbmVyLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuZXhwb3J0cy5ldmVudExpc3RlbmVyc01vZHVsZSA9IHtcbiAgICBjcmVhdGU6IHVwZGF0ZUV2ZW50TGlzdGVuZXJzLFxuICAgIHVwZGF0ZTogdXBkYXRlRXZlbnRMaXN0ZW5lcnMsXG4gICAgZGVzdHJveTogdXBkYXRlRXZlbnRMaXN0ZW5lcnNcbn07XG5leHBvcnRzLmRlZmF1bHQgPSBleHBvcnRzLmV2ZW50TGlzdGVuZXJzTW9kdWxlO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZXZlbnRsaXN0ZW5lcnMuanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5mdW5jdGlvbiB1cGRhdGVQcm9wcyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgICB2YXIga2V5LCBjdXIsIG9sZCwgZWxtID0gdm5vZGUuZWxtLCBvbGRQcm9wcyA9IG9sZFZub2RlLmRhdGEucHJvcHMsIHByb3BzID0gdm5vZGUuZGF0YS5wcm9wcztcbiAgICBpZiAoIW9sZFByb3BzICYmICFwcm9wcylcbiAgICAgICAgcmV0dXJuO1xuICAgIGlmIChvbGRQcm9wcyA9PT0gcHJvcHMpXG4gICAgICAgIHJldHVybjtcbiAgICBvbGRQcm9wcyA9IG9sZFByb3BzIHx8IHt9O1xuICAgIHByb3BzID0gcHJvcHMgfHwge307XG4gICAgZm9yIChrZXkgaW4gb2xkUHJvcHMpIHtcbiAgICAgICAgaWYgKCFwcm9wc1trZXldKSB7XG4gICAgICAgICAgICBkZWxldGUgZWxtW2tleV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgZm9yIChrZXkgaW4gcHJvcHMpIHtcbiAgICAgICAgY3VyID0gcHJvcHNba2V5XTtcbiAgICAgICAgb2xkID0gb2xkUHJvcHNba2V5XTtcbiAgICAgICAgaWYgKG9sZCAhPT0gY3VyICYmIChrZXkgIT09ICd2YWx1ZScgfHwgZWxtW2tleV0gIT09IGN1cikpIHtcbiAgICAgICAgICAgIGVsbVtrZXldID0gY3VyO1xuICAgICAgICB9XG4gICAgfVxufVxuZXhwb3J0cy5wcm9wc01vZHVsZSA9IHsgY3JlYXRlOiB1cGRhdGVQcm9wcywgdXBkYXRlOiB1cGRhdGVQcm9wcyB9O1xuZXhwb3J0cy5kZWZhdWx0ID0gZXhwb3J0cy5wcm9wc01vZHVsZTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXByb3BzLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xudmFyIHZub2RlXzEgPSByZXF1aXJlKFwiLi92bm9kZVwiKTtcbnZhciBpcyA9IHJlcXVpcmUoXCIuL2lzXCIpO1xudmFyIGh0bWxkb21hcGlfMSA9IHJlcXVpcmUoXCIuL2h0bWxkb21hcGlcIik7XG5mdW5jdGlvbiBpc1VuZGVmKHMpIHsgcmV0dXJuIHMgPT09IHVuZGVmaW5lZDsgfVxuZnVuY3Rpb24gaXNEZWYocykgeyByZXR1cm4gcyAhPT0gdW5kZWZpbmVkOyB9XG52YXIgZW1wdHlOb2RlID0gdm5vZGVfMS5kZWZhdWx0KCcnLCB7fSwgW10sIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcbmZ1bmN0aW9uIHNhbWVWbm9kZSh2bm9kZTEsIHZub2RlMikge1xuICAgIHJldHVybiB2bm9kZTEua2V5ID09PSB2bm9kZTIua2V5ICYmIHZub2RlMS5zZWwgPT09IHZub2RlMi5zZWw7XG59XG5mdW5jdGlvbiBpc1Zub2RlKHZub2RlKSB7XG4gICAgcmV0dXJuIHZub2RlLnNlbCAhPT0gdW5kZWZpbmVkO1xufVxuZnVuY3Rpb24gY3JlYXRlS2V5VG9PbGRJZHgoY2hpbGRyZW4sIGJlZ2luSWR4LCBlbmRJZHgpIHtcbiAgICB2YXIgaSwgbWFwID0ge30sIGtleSwgY2g7XG4gICAgZm9yIChpID0gYmVnaW5JZHg7IGkgPD0gZW5kSWR4OyArK2kpIHtcbiAgICAgICAgY2ggPSBjaGlsZHJlbltpXTtcbiAgICAgICAgaWYgKGNoICE9IG51bGwpIHtcbiAgICAgICAgICAgIGtleSA9IGNoLmtleTtcbiAgICAgICAgICAgIGlmIChrZXkgIT09IHVuZGVmaW5lZClcbiAgICAgICAgICAgICAgICBtYXBba2V5XSA9IGk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG1hcDtcbn1cbnZhciBob29rcyA9IFsnY3JlYXRlJywgJ3VwZGF0ZScsICdyZW1vdmUnLCAnZGVzdHJveScsICdwcmUnLCAncG9zdCddO1xudmFyIGhfMSA9IHJlcXVpcmUoXCIuL2hcIik7XG5leHBvcnRzLmggPSBoXzEuaDtcbnZhciB0aHVua18xID0gcmVxdWlyZShcIi4vdGh1bmtcIik7XG5leHBvcnRzLnRodW5rID0gdGh1bmtfMS50aHVuaztcbmZ1bmN0aW9uIGluaXQobW9kdWxlcywgZG9tQXBpKSB7XG4gICAgdmFyIGksIGosIGNicyA9IHt9O1xuICAgIHZhciBhcGkgPSBkb21BcGkgIT09IHVuZGVmaW5lZCA/IGRvbUFwaSA6IGh0bWxkb21hcGlfMS5kZWZhdWx0O1xuICAgIGZvciAoaSA9IDA7IGkgPCBob29rcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjYnNbaG9va3NbaV1dID0gW107XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBtb2R1bGVzLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICB2YXIgaG9vayA9IG1vZHVsZXNbal1baG9va3NbaV1dO1xuICAgICAgICAgICAgaWYgKGhvb2sgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNic1tob29rc1tpXV0ucHVzaChob29rKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiBlbXB0eU5vZGVBdChlbG0pIHtcbiAgICAgICAgdmFyIGlkID0gZWxtLmlkID8gJyMnICsgZWxtLmlkIDogJyc7XG4gICAgICAgIHZhciBjID0gZWxtLmNsYXNzTmFtZSA/ICcuJyArIGVsbS5jbGFzc05hbWUuc3BsaXQoJyAnKS5qb2luKCcuJykgOiAnJztcbiAgICAgICAgcmV0dXJuIHZub2RlXzEuZGVmYXVsdChhcGkudGFnTmFtZShlbG0pLnRvTG93ZXJDYXNlKCkgKyBpZCArIGMsIHt9LCBbXSwgdW5kZWZpbmVkLCBlbG0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjcmVhdGVSbUNiKGNoaWxkRWxtLCBsaXN0ZW5lcnMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIHJtQ2IoKSB7XG4gICAgICAgICAgICBpZiAoLS1saXN0ZW5lcnMgPT09IDApIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFyZW50XzEgPSBhcGkucGFyZW50Tm9kZShjaGlsZEVsbSk7XG4gICAgICAgICAgICAgICAgYXBpLnJlbW92ZUNoaWxkKHBhcmVudF8xLCBjaGlsZEVsbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNyZWF0ZUVsbSh2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgICAgIHZhciBpLCBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICAgICAgaWYgKGRhdGEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGlzRGVmKGkgPSBkYXRhLmhvb2spICYmIGlzRGVmKGkgPSBpLmluaXQpKSB7XG4gICAgICAgICAgICAgICAgaSh2bm9kZSk7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW4sIHNlbCA9IHZub2RlLnNlbDtcbiAgICAgICAgaWYgKHNlbCA9PT0gJyEnKSB7XG4gICAgICAgICAgICBpZiAoaXNVbmRlZih2bm9kZS50ZXh0KSkge1xuICAgICAgICAgICAgICAgIHZub2RlLnRleHQgPSAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZub2RlLmVsbSA9IGFwaS5jcmVhdGVDb21tZW50KHZub2RlLnRleHQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNlbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBQYXJzZSBzZWxlY3RvclxuICAgICAgICAgICAgdmFyIGhhc2hJZHggPSBzZWwuaW5kZXhPZignIycpO1xuICAgICAgICAgICAgdmFyIGRvdElkeCA9IHNlbC5pbmRleE9mKCcuJywgaGFzaElkeCk7XG4gICAgICAgICAgICB2YXIgaGFzaCA9IGhhc2hJZHggPiAwID8gaGFzaElkeCA6IHNlbC5sZW5ndGg7XG4gICAgICAgICAgICB2YXIgZG90ID0gZG90SWR4ID4gMCA/IGRvdElkeCA6IHNlbC5sZW5ndGg7XG4gICAgICAgICAgICB2YXIgdGFnID0gaGFzaElkeCAhPT0gLTEgfHwgZG90SWR4ICE9PSAtMSA/IHNlbC5zbGljZSgwLCBNYXRoLm1pbihoYXNoLCBkb3QpKSA6IHNlbDtcbiAgICAgICAgICAgIHZhciBlbG0gPSB2bm9kZS5lbG0gPSBpc0RlZihkYXRhKSAmJiBpc0RlZihpID0gZGF0YS5ucykgPyBhcGkuY3JlYXRlRWxlbWVudE5TKGksIHRhZylcbiAgICAgICAgICAgICAgICA6IGFwaS5jcmVhdGVFbGVtZW50KHRhZyk7XG4gICAgICAgICAgICBpZiAoaGFzaCA8IGRvdClcbiAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlKCdpZCcsIHNlbC5zbGljZShoYXNoICsgMSwgZG90KSk7XG4gICAgICAgICAgICBpZiAoZG90SWR4ID4gMClcbiAgICAgICAgICAgICAgICBlbG0uc2V0QXR0cmlidXRlKCdjbGFzcycsIHNlbC5zbGljZShkb3QgKyAxKS5yZXBsYWNlKC9cXC4vZywgJyAnKSk7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLmNyZWF0ZS5sZW5ndGg7ICsraSlcbiAgICAgICAgICAgICAgICBjYnMuY3JlYXRlW2ldKGVtcHR5Tm9kZSwgdm5vZGUpO1xuICAgICAgICAgICAgaWYgKGlzLmFycmF5KGNoaWxkcmVuKSkge1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2ggPSBjaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwaS5hcHBlbmRDaGlsZChlbG0sIGNyZWF0ZUVsbShjaCwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChpcy5wcmltaXRpdmUodm5vZGUudGV4dCkpIHtcbiAgICAgICAgICAgICAgICBhcGkuYXBwZW5kQ2hpbGQoZWxtLCBhcGkuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSA9IHZub2RlLmRhdGEuaG9vazsgLy8gUmV1c2UgdmFyaWFibGVcbiAgICAgICAgICAgIGlmIChpc0RlZihpKSkge1xuICAgICAgICAgICAgICAgIGlmIChpLmNyZWF0ZSlcbiAgICAgICAgICAgICAgICAgICAgaS5jcmVhdGUoZW1wdHlOb2RlLCB2bm9kZSk7XG4gICAgICAgICAgICAgICAgaWYgKGkuaW5zZXJ0KVxuICAgICAgICAgICAgICAgICAgICBpbnNlcnRlZFZub2RlUXVldWUucHVzaCh2bm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2bm9kZS5lbG0gPSBhcGkuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZub2RlLmVsbTtcbiAgICB9XG4gICAgZnVuY3Rpb24gYWRkVm5vZGVzKHBhcmVudEVsbSwgYmVmb3JlLCB2bm9kZXMsIHN0YXJ0SWR4LCBlbmRJZHgsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgICAgICBmb3IgKDsgc3RhcnRJZHggPD0gZW5kSWR4OyArK3N0YXJ0SWR4KSB7XG4gICAgICAgICAgICB2YXIgY2ggPSB2bm9kZXNbc3RhcnRJZHhdO1xuICAgICAgICAgICAgaWYgKGNoICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgY3JlYXRlRWxtKGNoLCBpbnNlcnRlZFZub2RlUXVldWUpLCBiZWZvcmUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIGludm9rZURlc3Ryb3lIb29rKHZub2RlKSB7XG4gICAgICAgIHZhciBpLCBqLCBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICAgICAgaWYgKGRhdGEgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGlzRGVmKGkgPSBkYXRhLmhvb2spICYmIGlzRGVmKGkgPSBpLmRlc3Ryb3kpKVxuICAgICAgICAgICAgICAgIGkodm5vZGUpO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5kZXN0cm95Lmxlbmd0aDsgKytpKVxuICAgICAgICAgICAgICAgIGNicy5kZXN0cm95W2ldKHZub2RlKTtcbiAgICAgICAgICAgIGlmICh2bm9kZS5jaGlsZHJlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHZub2RlLmNoaWxkcmVuLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgICAgIGkgPSB2bm9kZS5jaGlsZHJlbltqXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgIT0gbnVsbCAmJiB0eXBlb2YgaSAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW52b2tlRGVzdHJveUhvb2soaSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgdm5vZGVzLCBzdGFydElkeCwgZW5kSWR4KSB7XG4gICAgICAgIGZvciAoOyBzdGFydElkeCA8PSBlbmRJZHg7ICsrc3RhcnRJZHgpIHtcbiAgICAgICAgICAgIHZhciBpXzEgPSB2b2lkIDAsIGxpc3RlbmVycyA9IHZvaWQgMCwgcm0gPSB2b2lkIDAsIGNoID0gdm5vZGVzW3N0YXJ0SWR4XTtcbiAgICAgICAgICAgIGlmIChjaCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzRGVmKGNoLnNlbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52b2tlRGVzdHJveUhvb2soY2gpO1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSBjYnMucmVtb3ZlLmxlbmd0aCArIDE7XG4gICAgICAgICAgICAgICAgICAgIHJtID0gY3JlYXRlUm1DYihjaC5lbG0sIGxpc3RlbmVycyk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaV8xID0gMDsgaV8xIDwgY2JzLnJlbW92ZS5sZW5ndGg7ICsraV8xKVxuICAgICAgICAgICAgICAgICAgICAgICAgY2JzLnJlbW92ZVtpXzFdKGNoLCBybSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0RlZihpXzEgPSBjaC5kYXRhKSAmJiBpc0RlZihpXzEgPSBpXzEuaG9vaykgJiYgaXNEZWYoaV8xID0gaV8xLnJlbW92ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlfMShjaCwgcm0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcm0oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYXBpLnJlbW92ZUNoaWxkKHBhcmVudEVsbSwgY2guZWxtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gdXBkYXRlQ2hpbGRyZW4ocGFyZW50RWxtLCBvbGRDaCwgbmV3Q2gsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgICAgICB2YXIgb2xkU3RhcnRJZHggPSAwLCBuZXdTdGFydElkeCA9IDA7XG4gICAgICAgIHZhciBvbGRFbmRJZHggPSBvbGRDaC5sZW5ndGggLSAxO1xuICAgICAgICB2YXIgb2xkU3RhcnRWbm9kZSA9IG9sZENoWzBdO1xuICAgICAgICB2YXIgb2xkRW5kVm5vZGUgPSBvbGRDaFtvbGRFbmRJZHhdO1xuICAgICAgICB2YXIgbmV3RW5kSWR4ID0gbmV3Q2gubGVuZ3RoIC0gMTtcbiAgICAgICAgdmFyIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFswXTtcbiAgICAgICAgdmFyIG5ld0VuZFZub2RlID0gbmV3Q2hbbmV3RW5kSWR4XTtcbiAgICAgICAgdmFyIG9sZEtleVRvSWR4O1xuICAgICAgICB2YXIgaWR4SW5PbGQ7XG4gICAgICAgIHZhciBlbG1Ub01vdmU7XG4gICAgICAgIHZhciBiZWZvcmU7XG4gICAgICAgIHdoaWxlIChvbGRTdGFydElkeCA8PSBvbGRFbmRJZHggJiYgbmV3U3RhcnRJZHggPD0gbmV3RW5kSWR4KSB7XG4gICAgICAgICAgICBpZiAob2xkU3RhcnRWbm9kZSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdOyAvLyBWbm9kZSBtaWdodCBoYXZlIGJlZW4gbW92ZWQgbGVmdFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob2xkRW5kVm5vZGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAobmV3U3RhcnRWbm9kZSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAobmV3RW5kVm5vZGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoc2FtZVZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld1N0YXJ0Vm5vZGUpKSB7XG4gICAgICAgICAgICAgICAgcGF0Y2hWbm9kZShvbGRTdGFydFZub2RlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgICAgICAgIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFsrK29sZFN0YXJ0SWR4XTtcbiAgICAgICAgICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChzYW1lVm5vZGUob2xkRW5kVm5vZGUsIG5ld0VuZFZub2RlKSkge1xuICAgICAgICAgICAgICAgIHBhdGNoVm5vZGUob2xkRW5kVm5vZGUsIG5ld0VuZFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgICAgICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoc2FtZVZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld0VuZFZub2RlKSkge1xuICAgICAgICAgICAgICAgIHBhdGNoVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3RW5kVm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIG9sZFN0YXJ0Vm5vZGUuZWxtLCBhcGkubmV4dFNpYmxpbmcob2xkRW5kVm5vZGUuZWxtKSk7XG4gICAgICAgICAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdO1xuICAgICAgICAgICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoc2FtZVZub2RlKG9sZEVuZFZub2RlLCBuZXdTdGFydFZub2RlKSkge1xuICAgICAgICAgICAgICAgIHBhdGNoVm5vZGUob2xkRW5kVm5vZGUsIG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIG9sZEVuZFZub2RlLmVsbSwgb2xkU3RhcnRWbm9kZS5lbG0pO1xuICAgICAgICAgICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgICAgICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChvbGRLZXlUb0lkeCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIG9sZEtleVRvSWR4ID0gY3JlYXRlS2V5VG9PbGRJZHgob2xkQ2gsIG9sZFN0YXJ0SWR4LCBvbGRFbmRJZHgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZHhJbk9sZCA9IG9sZEtleVRvSWR4W25ld1N0YXJ0Vm5vZGUua2V5XTtcbiAgICAgICAgICAgICAgICBpZiAoaXNVbmRlZihpZHhJbk9sZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGNyZWF0ZUVsbShuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpLCBvbGRTdGFydFZub2RlLmVsbSk7XG4gICAgICAgICAgICAgICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVsbVRvTW92ZSA9IG9sZENoW2lkeEluT2xkXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVsbVRvTW92ZS5zZWwgIT09IG5ld1N0YXJ0Vm5vZGUuc2VsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgY3JlYXRlRWxtKG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSksIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGNoVm5vZGUoZWxtVG9Nb3ZlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb2xkQ2hbaWR4SW5PbGRdID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGVsbVRvTW92ZS5lbG0sIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChvbGRTdGFydElkeCA8PSBvbGRFbmRJZHggfHwgbmV3U3RhcnRJZHggPD0gbmV3RW5kSWR4KSB7XG4gICAgICAgICAgICBpZiAob2xkU3RhcnRJZHggPiBvbGRFbmRJZHgpIHtcbiAgICAgICAgICAgICAgICBiZWZvcmUgPSBuZXdDaFtuZXdFbmRJZHggKyAxXSA9PSBudWxsID8gbnVsbCA6IG5ld0NoW25ld0VuZElkeCArIDFdLmVsbTtcbiAgICAgICAgICAgICAgICBhZGRWbm9kZXMocGFyZW50RWxtLCBiZWZvcmUsIG5ld0NoLCBuZXdTdGFydElkeCwgbmV3RW5kSWR4LCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgb2xkQ2gsIG9sZFN0YXJ0SWR4LCBvbGRFbmRJZHgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIHBhdGNoVm5vZGUob2xkVm5vZGUsIHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICAgICAgdmFyIGksIGhvb2s7XG4gICAgICAgIGlmIChpc0RlZihpID0gdm5vZGUuZGF0YSkgJiYgaXNEZWYoaG9vayA9IGkuaG9vaykgJiYgaXNEZWYoaSA9IGhvb2sucHJlcGF0Y2gpKSB7XG4gICAgICAgICAgICBpKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGVsbSA9IHZub2RlLmVsbSA9IG9sZFZub2RlLmVsbTtcbiAgICAgICAgdmFyIG9sZENoID0gb2xkVm5vZGUuY2hpbGRyZW47XG4gICAgICAgIHZhciBjaCA9IHZub2RlLmNoaWxkcmVuO1xuICAgICAgICBpZiAob2xkVm5vZGUgPT09IHZub2RlKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBpZiAodm5vZGUuZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnVwZGF0ZS5sZW5ndGg7ICsraSlcbiAgICAgICAgICAgICAgICBjYnMudXBkYXRlW2ldKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgICAgICAgICBpID0gdm5vZGUuZGF0YS5ob29rO1xuICAgICAgICAgICAgaWYgKGlzRGVmKGkpICYmIGlzRGVmKGkgPSBpLnVwZGF0ZSkpXG4gICAgICAgICAgICAgICAgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc1VuZGVmKHZub2RlLnRleHQpKSB7XG4gICAgICAgICAgICBpZiAoaXNEZWYob2xkQ2gpICYmIGlzRGVmKGNoKSkge1xuICAgICAgICAgICAgICAgIGlmIChvbGRDaCAhPT0gY2gpXG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZUNoaWxkcmVuKGVsbSwgb2xkQ2gsIGNoLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaXNEZWYoY2gpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzRGVmKG9sZFZub2RlLnRleHQpKVxuICAgICAgICAgICAgICAgICAgICBhcGkuc2V0VGV4dENvbnRlbnQoZWxtLCAnJyk7XG4gICAgICAgICAgICAgICAgYWRkVm5vZGVzKGVsbSwgbnVsbCwgY2gsIDAsIGNoLmxlbmd0aCAtIDEsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChpc0RlZihvbGRDaCkpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVWbm9kZXMoZWxtLCBvbGRDaCwgMCwgb2xkQ2gubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChpc0RlZihvbGRWbm9kZS50ZXh0KSkge1xuICAgICAgICAgICAgICAgIGFwaS5zZXRUZXh0Q29udGVudChlbG0sICcnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvbGRWbm9kZS50ZXh0ICE9PSB2bm9kZS50ZXh0KSB7XG4gICAgICAgICAgICBpZiAoaXNEZWYob2xkQ2gpKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlVm5vZGVzKGVsbSwgb2xkQ2gsIDAsIG9sZENoLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXBpLnNldFRleHRDb250ZW50KGVsbSwgdm5vZGUudGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzRGVmKGhvb2spICYmIGlzRGVmKGkgPSBob29rLnBvc3RwYXRjaCkpIHtcbiAgICAgICAgICAgIGkob2xkVm5vZGUsIHZub2RlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZnVuY3Rpb24gcGF0Y2gob2xkVm5vZGUsIHZub2RlKSB7XG4gICAgICAgIHZhciBpLCBlbG0sIHBhcmVudDtcbiAgICAgICAgdmFyIGluc2VydGVkVm5vZGVRdWV1ZSA9IFtdO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnByZS5sZW5ndGg7ICsraSlcbiAgICAgICAgICAgIGNicy5wcmVbaV0oKTtcbiAgICAgICAgaWYgKCFpc1Zub2RlKG9sZFZub2RlKSkge1xuICAgICAgICAgICAgb2xkVm5vZGUgPSBlbXB0eU5vZGVBdChvbGRWbm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNhbWVWbm9kZShvbGRWbm9kZSwgdm5vZGUpKSB7XG4gICAgICAgICAgICBwYXRjaFZub2RlKG9sZFZub2RlLCB2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGVsbSA9IG9sZFZub2RlLmVsbTtcbiAgICAgICAgICAgIHBhcmVudCA9IGFwaS5wYXJlbnROb2RlKGVsbSk7XG4gICAgICAgICAgICBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgICAgICBpZiAocGFyZW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnQsIHZub2RlLmVsbSwgYXBpLm5leHRTaWJsaW5nKGVsbSkpO1xuICAgICAgICAgICAgICAgIHJlbW92ZVZub2RlcyhwYXJlbnQsIFtvbGRWbm9kZV0sIDAsIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBpbnNlcnRlZFZub2RlUXVldWUubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGluc2VydGVkVm5vZGVRdWV1ZVtpXS5kYXRhLmhvb2suaW5zZXJ0KGluc2VydGVkVm5vZGVRdWV1ZVtpXSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5wb3N0Lmxlbmd0aDsgKytpKVxuICAgICAgICAgICAgY2JzLnBvc3RbaV0oKTtcbiAgICAgICAgcmV0dXJuIHZub2RlO1xuICAgIH07XG59XG5leHBvcnRzLmluaXQgPSBpbml0O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c25hYmJkb20uanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG52YXIgaF8xID0gcmVxdWlyZShcIi4vaFwiKTtcbmZ1bmN0aW9uIGNvcHlUb1RodW5rKHZub2RlLCB0aHVuaykge1xuICAgIHRodW5rLmVsbSA9IHZub2RlLmVsbTtcbiAgICB2bm9kZS5kYXRhLmZuID0gdGh1bmsuZGF0YS5mbjtcbiAgICB2bm9kZS5kYXRhLmFyZ3MgPSB0aHVuay5kYXRhLmFyZ3M7XG4gICAgdGh1bmsuZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgdGh1bmsuY2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlbjtcbiAgICB0aHVuay50ZXh0ID0gdm5vZGUudGV4dDtcbiAgICB0aHVuay5lbG0gPSB2bm9kZS5lbG07XG59XG5mdW5jdGlvbiBpbml0KHRodW5rKSB7XG4gICAgdmFyIGN1ciA9IHRodW5rLmRhdGE7XG4gICAgdmFyIHZub2RlID0gY3VyLmZuLmFwcGx5KHVuZGVmaW5lZCwgY3VyLmFyZ3MpO1xuICAgIGNvcHlUb1RodW5rKHZub2RlLCB0aHVuayk7XG59XG5mdW5jdGlvbiBwcmVwYXRjaChvbGRWbm9kZSwgdGh1bmspIHtcbiAgICB2YXIgaSwgb2xkID0gb2xkVm5vZGUuZGF0YSwgY3VyID0gdGh1bmsuZGF0YTtcbiAgICB2YXIgb2xkQXJncyA9IG9sZC5hcmdzLCBhcmdzID0gY3VyLmFyZ3M7XG4gICAgaWYgKG9sZC5mbiAhPT0gY3VyLmZuIHx8IG9sZEFyZ3MubGVuZ3RoICE9PSBhcmdzLmxlbmd0aCkge1xuICAgICAgICBjb3B5VG9UaHVuayhjdXIuZm4uYXBwbHkodW5kZWZpbmVkLCBhcmdzKSwgdGh1bmspO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmIChvbGRBcmdzW2ldICE9PSBhcmdzW2ldKSB7XG4gICAgICAgICAgICBjb3B5VG9UaHVuayhjdXIuZm4uYXBwbHkodW5kZWZpbmVkLCBhcmdzKSwgdGh1bmspO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNvcHlUb1RodW5rKG9sZFZub2RlLCB0aHVuayk7XG59XG5leHBvcnRzLnRodW5rID0gZnVuY3Rpb24gdGh1bmsoc2VsLCBrZXksIGZuLCBhcmdzKSB7XG4gICAgaWYgKGFyZ3MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBhcmdzID0gZm47XG4gICAgICAgIGZuID0ga2V5O1xuICAgICAgICBrZXkgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiBoXzEuaChzZWwsIHtcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIGhvb2s6IHsgaW5pdDogaW5pdCwgcHJlcGF0Y2g6IHByZXBhdGNoIH0sXG4gICAgICAgIGZuOiBmbixcbiAgICAgICAgYXJnczogYXJnc1xuICAgIH0pO1xufTtcbmV4cG9ydHMuZGVmYXVsdCA9IGV4cG9ydHMudGh1bms7XG4vLyMgc291cmNlTWFwcGluZ1VSTD10aHVuay5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbnZhciB2bm9kZV8xID0gcmVxdWlyZShcIi4vdm5vZGVcIik7XG52YXIgaHRtbGRvbWFwaV8xID0gcmVxdWlyZShcIi4vaHRtbGRvbWFwaVwiKTtcbmZ1bmN0aW9uIHRvVk5vZGUobm9kZSwgZG9tQXBpKSB7XG4gICAgdmFyIGFwaSA9IGRvbUFwaSAhPT0gdW5kZWZpbmVkID8gZG9tQXBpIDogaHRtbGRvbWFwaV8xLmRlZmF1bHQ7XG4gICAgdmFyIHRleHQ7XG4gICAgaWYgKGFwaS5pc0VsZW1lbnQobm9kZSkpIHtcbiAgICAgICAgdmFyIGlkID0gbm9kZS5pZCA/ICcjJyArIG5vZGUuaWQgOiAnJztcbiAgICAgICAgdmFyIGNuID0gbm9kZS5nZXRBdHRyaWJ1dGUoJ2NsYXNzJyk7XG4gICAgICAgIHZhciBjID0gY24gPyAnLicgKyBjbi5zcGxpdCgnICcpLmpvaW4oJy4nKSA6ICcnO1xuICAgICAgICB2YXIgc2VsID0gYXBpLnRhZ05hbWUobm9kZSkudG9Mb3dlckNhc2UoKSArIGlkICsgYztcbiAgICAgICAgdmFyIGF0dHJzID0ge307XG4gICAgICAgIHZhciBjaGlsZHJlbiA9IFtdO1xuICAgICAgICB2YXIgbmFtZV8xO1xuICAgICAgICB2YXIgaSA9IHZvaWQgMCwgbiA9IHZvaWQgMDtcbiAgICAgICAgdmFyIGVsbUF0dHJzID0gbm9kZS5hdHRyaWJ1dGVzO1xuICAgICAgICB2YXIgZWxtQ2hpbGRyZW4gPSBub2RlLmNoaWxkTm9kZXM7XG4gICAgICAgIGZvciAoaSA9IDAsIG4gPSBlbG1BdHRycy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIG5hbWVfMSA9IGVsbUF0dHJzW2ldLm5vZGVOYW1lO1xuICAgICAgICAgICAgaWYgKG5hbWVfMSAhPT0gJ2lkJyAmJiBuYW1lXzEgIT09ICdjbGFzcycpIHtcbiAgICAgICAgICAgICAgICBhdHRyc1tuYW1lXzFdID0gZWxtQXR0cnNbaV0ubm9kZVZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IDAsIG4gPSBlbG1DaGlsZHJlbi5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIGNoaWxkcmVuLnB1c2godG9WTm9kZShlbG1DaGlsZHJlbltpXSwgZG9tQXBpKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZub2RlXzEuZGVmYXVsdChzZWwsIHsgYXR0cnM6IGF0dHJzIH0sIGNoaWxkcmVuLCB1bmRlZmluZWQsIG5vZGUpO1xuICAgIH1cbiAgICBlbHNlIGlmIChhcGkuaXNUZXh0KG5vZGUpKSB7XG4gICAgICAgIHRleHQgPSBhcGkuZ2V0VGV4dENvbnRlbnQobm9kZSk7XG4gICAgICAgIHJldHVybiB2bm9kZV8xLmRlZmF1bHQodW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdGV4dCwgbm9kZSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGFwaS5pc0NvbW1lbnQobm9kZSkpIHtcbiAgICAgICAgdGV4dCA9IGFwaS5nZXRUZXh0Q29udGVudChub2RlKTtcbiAgICAgICAgcmV0dXJuIHZub2RlXzEuZGVmYXVsdCgnIScsIHt9LCBbXSwgdGV4dCwgbm9kZSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gdm5vZGVfMS5kZWZhdWx0KCcnLCB7fSwgW10sIHVuZGVmaW5lZCwgbm9kZSk7XG4gICAgfVxufVxuZXhwb3J0cy50b1ZOb2RlID0gdG9WTm9kZTtcbmV4cG9ydHMuZGVmYXVsdCA9IHRvVk5vZGU7XG4vLyMgc291cmNlTWFwcGluZ1VSTD10b3Zub2RlLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZnVuY3Rpb24gdm5vZGUoc2VsLCBkYXRhLCBjaGlsZHJlbiwgdGV4dCwgZWxtKSB7XG4gICAgdmFyIGtleSA9IGRhdGEgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGRhdGEua2V5O1xuICAgIHJldHVybiB7IHNlbDogc2VsLCBkYXRhOiBkYXRhLCBjaGlsZHJlbjogY2hpbGRyZW4sXG4gICAgICAgIHRleHQ6IHRleHQsIGVsbTogZWxtLCBrZXk6IGtleSB9O1xufVxuZXhwb3J0cy52bm9kZSA9IHZub2RlO1xuZXhwb3J0cy5kZWZhdWx0ID0gdm5vZGU7XG4vLyMgc291cmNlTWFwcGluZ1VSTD12bm9kZS5qcy5tYXAiLCJmdW5jdGlvbiBub29wKCkge31cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAodXJsLCBvcHRzKSB7XG5cdG9wdHMgPSBvcHRzIHx8IHt9O1xuXG5cdHZhciB3cywgbnVtPTAsIHRpbWVyPTEsICQ9e307XG5cdHZhciBtYXggPSBvcHRzLm1heEF0dGVtcHRzIHx8IEluZmluaXR5O1xuXG5cdCQub3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0XHR3cyA9IG5ldyBXZWJTb2NrZXQodXJsLCBvcHRzLnByb3RvY29scyB8fCBbXSk7XG5cblx0XHR3cy5vbm1lc3NhZ2UgPSBvcHRzLm9ubWVzc2FnZSB8fCBub29wO1xuXG5cdFx0d3Mub25vcGVuID0gZnVuY3Rpb24gKGUpIHtcblx0XHRcdChvcHRzLm9ub3BlbiB8fCBub29wKShlKTtcblx0XHRcdG51bSA9IDA7XG5cdFx0fTtcblxuXHRcdHdzLm9uY2xvc2UgPSBmdW5jdGlvbiAoZSkge1xuXHRcdFx0ZS5jb2RlID09PSAxZTMgfHwgZS5jb2RlID09PSAxMDAxIHx8IGUuY29kZSA9PT0gMTAwNSB8fCAkLnJlY29ubmVjdChlKTtcblx0XHRcdChvcHRzLm9uY2xvc2UgfHwgbm9vcCkoZSk7XG5cdFx0fTtcblxuXHRcdHdzLm9uZXJyb3IgPSBmdW5jdGlvbiAoZSkge1xuXHRcdFx0KGUgJiYgZS5jb2RlPT09J0VDT05OUkVGVVNFRCcpID8gJC5yZWNvbm5lY3QoZSkgOiAob3B0cy5vbmVycm9yIHx8IG5vb3ApKGUpO1xuXHRcdH07XG5cdH07XG5cblx0JC5yZWNvbm5lY3QgPSBmdW5jdGlvbiAoZSkge1xuXHRcdGlmICh0aW1lciAmJiBudW0rKyA8IG1heCkge1xuXHRcdFx0dGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0KG9wdHMub25yZWNvbm5lY3QgfHwgbm9vcCkoZSk7XG5cdFx0XHRcdCQub3BlbigpO1xuXHRcdFx0fSwgb3B0cy50aW1lb3V0IHx8IDFlMyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdChvcHRzLm9ubWF4aW11bSB8fCBub29wKShlKTtcblx0XHR9XG5cdH07XG5cblx0JC5qc29uID0gZnVuY3Rpb24gKHgpIHtcblx0XHR3cy5zZW5kKEpTT04uc3RyaW5naWZ5KHgpKTtcblx0fTtcblxuXHQkLnNlbmQgPSBmdW5jdGlvbiAoeCkge1xuXHRcdHdzLnNlbmQoeCk7XG5cdH07XG5cblx0JC5jbG9zZSA9IGZ1bmN0aW9uICh4LCB5KSB7XG5cdFx0dGltZXIgPSBjbGVhclRpbWVvdXQodGltZXIpO1xuXHRcdHdzLmNsb3NlKHggfHwgMWUzLCB5KTtcblx0fTtcblxuXHQkLm9wZW4oKTsgLy8gaW5pdFxuXG5cdHJldHVybiAkO1xufVxuIiwiaW1wb3J0IGggZnJvbSAnc25hYmJkb20vaCc7XHJcbmltcG9ydCB7IFZOb2RlIH0gZnJvbSAnc25hYmJkb20vdm5vZGUnO1xyXG5cclxuaW1wb3J0IHsgcmVuZGVyVXNlcm5hbWUgfSBmcm9tICcuL3VzZXInO1xyXG5cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBhYm91dFZpZXcobW9kZWwpOiBWTm9kZVtdIHtcclxuICAgIHJlbmRlclVzZXJuYW1lKG1vZGVsW1wiaG9tZVwiXSwgbW9kZWxbXCJ1c2VybmFtZVwiXSk7XHJcblxyXG4gICAgY29uc29sZS5sb2cobW9kZWwpO1xyXG4gICAgcmV0dXJuIFtoKCdhc2lkZS5zaWRlYmFyLWZpcnN0JyksXHJcbiAgICAgICAgICAgIGgoJ21haW4ubWFpbicsIFtcclxuICAgICAgICAgICAgICAgIGgoJ2Rpdi5hYm91dCcsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdoMicsIFwiQWJvdXQgcHljaGVzcy12YXJpYW50c1wiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdwJywgXCJweWNoZXNzLXZhcmlhbnRzIGlzIGEgZnJlZSwgb3Blbi1zb3VyY2UgY2hlc3Mgc2VydmVyIGRlc2lnbmVkIHRvIHBsYXkgc2V2ZXJhbCBjaGVzcyB2YXJpYW50cy5cIiksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgncCcsIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJDdXJyZW50bHkgc3VwcG9ydGVkIGdhbWVzIGFyZSBcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnYScsIHthdHRyczoge2hyZWY6ICdodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9NYWtydWsnfX0sICdNYWtydWsnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCIsIFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdhJywge2F0dHJzOiB7aHJlZjogJ2h0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1NpdHR1eWluJ319LCAnU2l0dHV5aW4nKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCIsIFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdhJywge2F0dHJzOiB7aHJlZjogJ2h0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1Nob2dpJ319LCAnU2hvZ2knKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCIsIFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdhJywge2F0dHJzOiB7aHJlZjogJ2h0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1hpYW5ncWknfX0sICdYaWFuZ3FpJyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiLCBcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnYScsIHthdHRyczoge2hyZWY6ICdodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9DYXBhYmxhbmNhJ319LCAnQ2FwYWJsYW5jYScpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiwgXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2EnLCB7YXR0cnM6IHtocmVmOiAnaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvU2VpcmF3YW4nfX0sICdTZWlyYXdhbicpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiwgXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2EnLCB7YXR0cnM6IHtocmVmOiAnaHR0cDovL3d3dy5xdWFudHVtZ2FtYml0ei5jb20vYmxvZy9jaGVzcy9jZ2EvYnJvbnN0ZWluLWNoZXNzLXByZS1jaGVzcy1zaHVmZmxlLWNoZXNzJ319LCAnUGxhY2VtZW50JyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiLCBcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnYScsIHthdHRyczoge2hyZWY6ICdodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9DcmF6eWhvdXNlJ319LCAnQ3Jhenlob3VzZScpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiwgXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2EnLCB7YXR0cnM6IHtocmVmOiAnaHR0cHM6Ly93d3cudHdpdGNoLnR2L3ZpZGVvcy80NjYyNTM4MTUnfX0sICdDYXBhaG91c2UnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCIgYW5kIHN0YW5kYXJkIFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdhJywge2F0dHJzOiB7aHJlZjogJ2h0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0NoZXNzJ319LCAnQ2hlc3MuJyksXHJcbiAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgncCcsIFsnQWRkaXRpb25hbGx5IHlvdSBjYW4gY2hlY2sgQ2hlc3M5NjAgb3B0aW9uIGluIGZvciBTdGFuZGFyZCwgQ3Jhenlob3VzZSwgQ2FwYWJsYW5jYSBhbmQgQ2FwYWhvdXNlIHRvIHN0YXJ0IGdhbWVzIGZyb20gcmFuZG9tIHBvc2l0aW9ucyB3aXRoICcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoKCdhJywge2F0dHJzOiB7aHJlZjogJ2h0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0NoZXNzOTYwI0Nhc3RsaW5nX3J1bGVzJ319LCAnQ2hlc3M5NjAgY2FzdGxpbmcgcnVsZXMuJylcclxuICAgICAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgncCcsIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ0ZvciBtb3ZlIGdlbmVyYXRpb24sIHZhbGlkYXRpb24gYW5kIGVuZ2luZSBwbGF5IGl0IHVzZXMgJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnYScsIHthdHRyczoge2hyZWY6ICdodHRwczovL2dpdGh1Yi5jb20vZ2J0YW1pL0ZhaXJ5LVN0b2NrZmlzaCd9fSwgJ0ZhaXJ5LVN0b2NrZmlzaCcpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiwgXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2EnLCB7YXR0cnM6IHtocmVmOiAnaHR0cHM6Ly9naXRodWIuY29tL3hxYmFzZS9lbGVleWUnfX0sICdFbGVwaGFudEV5ZScpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiwgXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2EnLCB7YXR0cnM6IHtocmVmOiAnaHR0cHM6Ly9naXRodWIuY29tL3dhbGtlcjgwODgvbW9vbmZpc2gnfX0sICdtb29uZmlzaCcpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiBhbmQgXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2EnLCB7YXR0cnM6IHtocmVmOiAnaHR0cHM6Ly9naXRodWIuY29tL2didGFtaS9saWNoZXNzLWJvdC12YXJpYW50cyd9fSwgJ2xpY2hlc3MtYm90LXZhcmlhbnRzLicpLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ3AnLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdPbiBjbGllbnQgc2lkZSBpdCBpcyBiYXNlZCBvbiAnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdhJywge2F0dHJzOiB7aHJlZjogJ2h0dHBzOi8vZ2l0aHViLmNvbS9nYnRhbWkvY2hlc3Nncm91bmR4J319LCAnY2hlc3Nncm91bmR4LicpLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ3AnLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdTb3VyY2UgY29kZSBvZiBzZXJ2ZXIgaXMgYXZhaWxhYmxlIGF0ICcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2EnLCB7YXR0cnM6IHtocmVmOiAnaHR0cHM6Ly9naXRodWIuY29tL2didGFtaS9weWNoZXNzLXZhcmlhbnRzJ319LCAnR2l0SHViLicpLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgIGgoJ2FzaWRlLnNpZGViYXItc2Vjb25kJyksXHJcbiAgICAgICAgICAgIF0pLFxyXG4gICAgICAgIF07XHJcbn1cclxuIiwiaW1wb3J0IHsgaW5pdCB9IGZyb20gXCJzbmFiYmRvbVwiO1xuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xuaW1wb3J0IGF0dHJpYnV0ZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9hdHRyaWJ1dGVzJztcbmltcG9ydCBwcm9wZXJ0aWVzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvcHJvcHMnO1xuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcblxuY29uc3QgcGF0Y2ggPSBpbml0KFtrbGFzcywgYXR0cmlidXRlcywgcHJvcGVydGllcywgbGlzdGVuZXJzXSk7XG5cbmltcG9ydCBoIGZyb20gJ3NuYWJiZG9tL2gnO1xuXG5leHBvcnQgZnVuY3Rpb24gY2hhdFZpZXcgKGN0cmwsIGNoYXRUeXBlKSB7XG4gICAgZnVuY3Rpb24gb25LZXlQcmVzcyAoZSkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gKGUudGFyZ2V0IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlXG4gICAgICAgIGlmICgoZS5rZXlDb2RlID09IDEzIHx8IGUud2hpY2ggPT0gMTMpICYmIG1lc3NhZ2UubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY2hhdE1lc3NhZ2UgKGN0cmwubW9kZWxbJ3VzZXJuYW1lJ10sIG1lc3NhZ2UsIGNoYXRUeXBlKTtcbiAgICAgICAgICAgIGN0cmwuc29jay5zZW5kKEpTT04uc3RyaW5naWZ5KHtcInR5cGVcIjogY2hhdFR5cGUsIFwibWVzc2FnZVwiOiBtZXNzYWdlLCBcImdhbWVJZFwiOiBjdHJsLm1vZGVsW1wiZ2FtZUlkXCJdIH0pKTtcbiAgICAgICAgICAgIChlLnRhcmdldCBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZSA9IFwiXCI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gaChgZGl2LiR7Y2hhdFR5cGV9IyR7Y2hhdFR5cGV9YCwgeyBjbGFzczoge1wiY2hhdFwiOiB0cnVlfSB9LCBbXG4gICAgICAgICAgICAgICAgaChgb2wjJHtjaGF0VHlwZX0tbWVzc2FnZXNgLCBbIGgoXCJkaXYjbWVzc2FnZXNcIildKSxcbiAgICAgICAgICAgICAgICBoKCdpbnB1dCNjaGF0LWVudHJ5Jywge1xuICAgICAgICAgICAgICAgICAgICBwcm9wczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJ0ZXh0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcImVudHJ5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdXRvY29tcGxldGU6IFwib2ZmXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcjogXCJQbGVhc2UgYmUgbmljZSBpbiB0aGUgY2hhdCFcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heGxlbmd0aDogXCIxNDBcIixcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgb246IHsga2V5cHJlc3M6IChlKSA9PiBvbktleVByZXNzKGUpIH0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF0pXG4gICAgfVxuXG5leHBvcnQgZnVuY3Rpb24gY2hhdE1lc3NhZ2UgKHVzZXIsIG1lc3NhZ2UsIGNoYXRUeXBlKSB7XG4gICAgY29uc3QgbXlEaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjaGF0VHlwZSArICctbWVzc2FnZXMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICAvLyBZb3UgbXVzdCBhZGQgYm9yZGVyIHdpZHRocywgcGFkZGluZyBhbmQgbWFyZ2lucyB0byB0aGUgcmlnaHQuXG4gICAgY29uc3QgaXNTY3JvbGxlZCA9IG15RGl2LnNjcm9sbFRvcCA9PSBteURpdi5zY3JvbGxIZWlnaHQgLSBteURpdi5vZmZzZXRIZWlnaHQ7XG5cbiAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21lc3NhZ2VzJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgaWYgKHVzZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgnZGl2I21lc3NhZ2VzJywgWyBoKFwibGkubWVzc2FnZS5vZmZlclwiLCBbaChcInRcIiwgbWVzc2FnZSldKSBdKSk7XG4gICAgfSBlbHNlIGlmICh1c2VyID09PSAnX3NlcnZlcicpIHtcbiAgICAgICAgcGF0Y2goY29udGFpbmVyLCBoKCdkaXYjbWVzc2FnZXMnLCBbIGgoXCJsaS5tZXNzYWdlLnNlcnZlclwiLCBbaChcInVzZXJcIiwgJ1NlcnZlcicpLCBoKFwidFwiLCBtZXNzYWdlKV0pIF0pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2RpdiNtZXNzYWdlcycsIFsgaChcImxpLm1lc3NhZ2VcIiwgW2goXCJ1c2VyXCIsIHVzZXIpLCBoKFwidFwiLCBtZXNzYWdlKV0pIF0pKTtcbiAgICB9O1xuXG4gICAgaWYgKGlzU2Nyb2xsZWQpIG15RGl2LnNjcm9sbFRvcCA9IG15RGl2LnNjcm9sbEhlaWdodDtcbn0iLCJpbXBvcnQgeyBrZXkycG9zIH0gZnJvbSAnY2hlc3Nncm91bmR4L3V0aWwnO1xyXG5pbXBvcnQgeyBDb2xvciwgR2VvbWV0cnksIEtleSwgUm9sZSB9IGZyb20gJ2NoZXNzZ3JvdW5keC90eXBlcyc7XHJcblxyXG5leHBvcnQgY29uc3QgdmFyaWFudHMgPSBbXCJtYWtydWtcIiwgXCJzaXR0dXlpblwiLCBcInBsYWNlbWVudFwiLCBcImNyYXp5aG91c2VcIiwgXCJzdGFuZGFyZFwiLCBcInNob2dpXCIsIFwieGlhbmdxaVwiLCBcImNhcGFibGFuY2FcIiwgXCJzZWlyYXdhblwiLCBcImNhcGFob3VzZVwiLCBcInNob3VzZVwiXTtcclxuZXhwb3J0IGNvbnN0IHZhcmlhbnRzOTYwID0gW1wiY3Jhenlob3VzZVwiLCBcInN0YW5kYXJkXCIsIFwiY2FwYWJsYW5jYVwiLCBcImNhcGFob3VzZVwiXTtcclxuXHJcbmV4cG9ydCBjb25zdCBWQVJJQU5UUyA9IHtcclxuICAgIG1ha3J1azogeyBnZW9tOiBHZW9tZXRyeS5kaW04eDgsIGNnOiBcImNnLTUxMlwiLCBib2FyZDogXCJncmlkXCIsIHBpZWNlczogXCJtYWtydWtcIiwgY3NzOiBbXCJtYWtydWtcIl0sIGljb246IFwiUVwifSxcclxuICAgIHNpdHR1eWluOiB7IGdlb206IEdlb21ldHJ5LmRpbTh4OCwgY2c6IFwiY2ctNTEyXCIsIGJvYXJkOiBcImdyaWR4XCIsIHBpZWNlczogXCJtYWtydWtcIiwgY3NzOiBbXCJtYWtydWtcIl0sIGljb246IFwiUlwiIH0sXHJcbiAgICBzaG9naTogeyBnZW9tOiBHZW9tZXRyeS5kaW05eDksIGNnOiBcImNnLTU3NlwiLCBib2FyZDogXCJncmlkOXg5XCIsIHBpZWNlczogXCJzaG9naVwiLCBjc3M6IFtcInNob2dpMFwiLCBcInNob2dpMHdcIiwgXCJzaG9naTBwXCJdLCBpY29uOiBcIktcIiB9LFxyXG4gICAgeGlhbmdxaTogeyBnZW9tOiBHZW9tZXRyeS5kaW05eDEwLCBjZzogXCJjZy01NzYtNjQwXCIsIGJvYXJkOiBcInJpdmVyXCIsIHBpZWNlczogXCJ4aWFuZ3FpXCIsIGNzczogW1wieGlhbmdxaVwiLCBcInhpYW5ncWllXCIsIFwieGlhbmdxaWN0MlwiXSwgaWNvbjogXCJPXCIgfSxcclxuICAgIHBsYWNlbWVudDogeyBnZW9tOiBHZW9tZXRyeS5kaW04eDgsIGNnOiBcImNnLTUxMlwiLCBib2FyZDogXCJicm93blwiLCBwaWVjZXM6IFwibWVyaWRhXCIsIGNzczogW1wic3RhbmRhcmRcIl0sIGljb246IFwiU1wiIH0sXHJcbiAgICBjcmF6eWhvdXNlOiB7IGdlb206IEdlb21ldHJ5LmRpbTh4OCwgY2c6IFwiY2ctNTEyXCIsIGJvYXJkOiBcImJyb3duXCIsIHBpZWNlczogXCJtZXJpZGFcIiwgY3NzOiBbXCJzdGFuZGFyZFwiXSwgaWNvbjogXCJIXCIgfSxcclxuICAgIGNhcGFibGFuY2E6IHsgZ2VvbTogR2VvbWV0cnkuZGltMTB4OCwgY2c6IFwiY2ctNjQwXCIsIGJvYXJkOiBcImNhcGFibGFuY2FcIiwgcGllY2VzOiBcIm1lcmlkYVwiLCBjc3M6IFtcImNhcGFzZWkwXCIsIFwiY2FwYXNlaTFcIl0sIGljb246IFwiUFwiIH0sXHJcbiAgICBjYXBhaG91c2U6IHsgZ2VvbTogR2VvbWV0cnkuZGltMTB4OCwgY2c6IFwiY2ctNjQwXCIsIGJvYXJkOiBcImNhcGFibGFuY2FcIiwgcGllY2VzOiBcIm1lcmlkYVwiLCBjc3M6IFtcImNhcGFzZWkwXCIsIFwiY2FwYXNlaTFcIl0sIGljb246IFwiUFwiIH0sXHJcbiAgICBzZWlyYXdhbjogeyBnZW9tOiBHZW9tZXRyeS5kaW04eDgsIGNnOiBcImNnLTUxMlwiLCBib2FyZDogXCJicm93blwiLCBwaWVjZXM6IFwibWVyaWRhXCIsIGNzczogW1wiY2FwYXNlaTFcIiwgXCJjYXBhc2VpMFwiXSwgaWNvbjogXCJMXCIgfSxcclxuICAgIHNob3VzZTogeyBnZW9tOiBHZW9tZXRyeS5kaW04eDgsIGNnOiBcImNnLTUxMlwiLCBib2FyZDogXCJicm93blwiLCBwaWVjZXM6IFwibWVyaWRhXCIsIGNzczogW1wiY2FwYXNlaTFcIiwgXCJjYXBhc2VpMFwiXSwgaWNvbjogXCJMXCIgfSxcclxuICAgIHN0YW5kYXJkOiB7IGdlb206IEdlb21ldHJ5LmRpbTh4OCwgY2c6IFwiY2ctNTEyXCIsIGJvYXJkOiBcImJyb3duXCIsIHBpZWNlczogXCJtZXJpZGFcIiwgY3NzOiBbXCJzdGFuZGFyZFwiXSwgaWNvbjogXCJNXCIgfSxcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBvY2tldFJvbGVzKHZhcmlhbnQ6IHN0cmluZykge1xyXG4gICAgc3dpdGNoICh2YXJpYW50KSB7XHJcbiAgICBjYXNlIFwic2l0dHV5aW5cIjpcclxuICAgICAgICByZXR1cm4gW1wicm9va1wiLCBcImtuaWdodFwiLCBcInNpbHZlclwiLCBcImZlcnpcIiwgXCJraW5nXCJdO1xyXG4gICAgY2FzZSBcImNyYXp5aG91c2VcIjpcclxuICAgICAgICByZXR1cm4gW1wicGF3blwiLCBcImtuaWdodFwiLCBcImJpc2hvcFwiLCBcInJvb2tcIiwgXCJxdWVlblwiXTtcclxuICAgIGNhc2UgXCJjYXBhaG91c2VcIjpcclxuICAgICAgICByZXR1cm4gW1wicGF3blwiLCBcImtuaWdodFwiLCBcImJpc2hvcFwiLCBcInJvb2tcIiwgXCJxdWVlblwiLCBcImFyY2hiaXNob3BcIiwgXCJjYW5jZWxsb3JcIl07XHJcbiAgICBjYXNlIFwic2hvZ2lcIjpcclxuICAgICAgICByZXR1cm4gW1wicGF3blwiLCBcImxhbmNlXCIsIFwia25pZ2h0XCIsIFwiYmlzaG9wXCIsIFwicm9va1wiLCBcInNpbHZlclwiLCBcImdvbGRcIl07XHJcbiAgICBjYXNlIFwic2hvdXNlXCI6XHJcbiAgICAgICAgcmV0dXJuIFtcInBhd25cIiwgXCJrbmlnaHRcIiwgXCJiaXNob3BcIiwgXCJyb29rXCIsIFwicXVlZW5cIiwgXCJlbGVwaGFudFwiLCBcImhhd2tcIl07XHJcbiAgICBjYXNlIFwic2VpcmF3YW5cIjpcclxuICAgICAgICByZXR1cm4gW1wiZWxlcGhhbnRcIiwgXCJoYXdrXCJdO1xyXG4gICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gW1wicm9va1wiLCBcImtuaWdodFwiLCBcImJpc2hvcFwiLCBcInF1ZWVuXCIsIFwia2luZ1wiXTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcHJvbW90aW9uWm9uZSh2YXJpYW50OiBzdHJpbmcsIGNvbG9yOiBzdHJpbmcpIHtcclxuICAgIHN3aXRjaCAodmFyaWFudCkge1xyXG4gICAgY2FzZSAnc2hvZ2knOlxyXG4gICAgICAgIHJldHVybiBjb2xvciA9PT0gJ3doaXRlJyA/ICdhOWI5YzlkOWU5ZjlnOWg5aTlhOGI4YzhkOGU4ZjhnOGg4aThhN2I3YzdkN2U3ZjdnN2g3aTcnIDogJ2ExYjFjMWQxZTFmMWcxaDFpMWEyYjJjMmQyZTJmMmcyaDJpMmEzYjNjM2QzZTNmM2czaDNpMyc7XHJcbiAgICBjYXNlICdtYWtydWsnOlxyXG4gICAgICAgIHJldHVybiBjb2xvciA9PT0gJ3doaXRlJyA/ICdhNmI2YzZkNmU2ZjZnNmg2JyA6ICdhM2IzYzNkM2UzZjNnM2gzJztcclxuICAgIGNhc2UgJ3NpdHR1eWluJzpcclxuICAgICAgICByZXR1cm4gY29sb3IgPT09ICd3aGl0ZScgPyAnYThiN2M2ZDVlNWY2ZzdoOCcgOiAnYTFiMmMzZDRlNGYzZzJoMSc7XHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJldHVybiBjb2xvciA9PT0gJ3doaXRlJyA/ICdhOGI4YzhkOGU4ZjhnOGg4aThqOCcgOiAnYTFiMWMxZDFlMWYxZzFoMWkxajEnO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcHJvbW90aW9uUm9sZXModmFyaWFudDogc3RyaW5nLCByb2xlOiBSb2xlKSB7XHJcbiAgICBzd2l0Y2ggKHZhcmlhbnQpIHtcclxuICAgIGNhc2UgXCJjYXBhaG91c2VcIjpcclxuICAgIGNhc2UgXCJjYXBhYmxhbmNhXCI6XHJcbiAgICAgICAgcmV0dXJuIFtcInF1ZWVuXCIsIFwia25pZ2h0XCIsIFwicm9va1wiLCBcImJpc2hvcFwiLCBcImFyY2hiaXNob3BcIiwgXCJjYW5jZWxsb3JcIl07XHJcbiAgICBjYXNlIFwic2hvdXNlXCI6XHJcbiAgICBjYXNlIFwic2VpcmF3YW5cIjpcclxuICAgICAgICByZXR1cm4gW1wicXVlZW5cIiwgXCJrbmlnaHRcIiwgXCJyb29rXCIsIFwiYmlzaG9wXCIsIFwiZWxlcGhhbnRcIiwgXCJoYXdrXCJdO1xyXG4gICAgY2FzZSBcInNob2dpXCI6XHJcbiAgICAgICAgcmV0dXJuIFtcInBcIiArIHJvbGUsIHJvbGVdO1xyXG4gICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gW1wicXVlZW5cIiwgXCJrbmlnaHRcIiwgXCJyb29rXCIsIFwiYmlzaG9wXCJdO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWFuZGF0b3J5UHJvbW90aW9uKHJvbGU6IFJvbGUsIGRlc3Q6IEtleSwgY29sb3I6IENvbG9yKSB7XHJcbiAgICBzd2l0Y2ggKHJvbGUpIHtcclxuICAgIGNhc2UgXCJwYXduXCI6XHJcbiAgICBjYXNlIFwibGFuY2VcIjpcclxuICAgICAgICBpZiAoY29sb3IgPT09IFwid2hpdGVcIikge1xyXG4gICAgICAgICAgICByZXR1cm4gZGVzdFsxXSA9PT0gXCI5XCI7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIGRlc3RbMV0gPT09IFwiMVwiO1xyXG4gICAgICAgIH1cclxuICAgIGNhc2UgXCJrbmlnaHRcIjpcclxuICAgICAgICBpZiAoY29sb3IgPT09IFwid2hpdGVcIikge1xyXG4gICAgICAgICAgICByZXR1cm4gZGVzdFsxXSA9PT0gXCI5XCIgfHwgZGVzdFsxXSA9PT0gXCI4XCI7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIGRlc3RbMV0gPT09IFwiMVwiIHx8IGRlc3RbMV0gPT09IFwiMlwiO1xyXG4gICAgICAgIH1cclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbmVlZFBvY2tldHModmFyaWFudDogc3RyaW5nKSB7XHJcbiAgICByZXR1cm4gdmFyaWFudCA9PT0gJ3BsYWNlbWVudCcgfHwgdmFyaWFudCA9PT0gJ2NyYXp5aG91c2UnIHx8IHZhcmlhbnQgPT09ICdzaXR0dXlpbicgfHwgdmFyaWFudCA9PT0gJ3Nob2dpJyB8fCB2YXJpYW50ID09PSAnc2VpcmF3YW4nIHx8IHZhcmlhbnQgPT09ICdjYXBhaG91c2UnIHx8IHZhcmlhbnQgPT09ICdzaG91c2UnXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBoYXNFcCh2YXJpYW50OiBzdHJpbmcpIHtcclxuICAgIHJldHVybiB2YXJpYW50ID09PSAnc3RhbmRhcmQnIHx8IHZhcmlhbnQgPT09ICdwbGFjZW1lbnQnIHx8IHZhcmlhbnQgPT09ICdjcmF6eWhvdXNlJyB8fCB2YXJpYW50ID09PSAnY2FwYWJsYW5jYScgfHwgdmFyaWFudCA9PT0gJ3NlaXJhd2FuJyB8fCB2YXJpYW50ID09PSAnY2FwYWhvdXNlJyB8fCB2YXJpYW50ID09PSAnc2hvdXNlJ1xyXG59XHJcblxyXG5mdW5jdGlvbiBkaWZmKGE6IG51bWJlciwgYjpudW1iZXIpOm51bWJlciB7XHJcbiAgcmV0dXJuIE1hdGguYWJzKGEgLSBiKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZGlhZ29uYWxNb3ZlKHBvczEsIHBvczIpIHtcclxuICAgIGNvbnN0IHhkID0gZGlmZihwb3MxWzBdLCBwb3MyWzBdKTtcclxuICAgIGNvbnN0IHlkID0gZGlmZihwb3MxWzFdLCBwb3MyWzFdKTtcclxuICAgIHJldHVybiB4ZCA9PT0geWQgJiYgeGQgPT09IDE7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjYW5HYXRlKGZlbiwgcGllY2UsIG9yaWcsIGRlc3QsIG1ldGEpIHtcclxuICAgIGNvbnNvbGUubG9nKFwiICAgaXNHYXRpbmcoKVwiLCBmZW4sIHBpZWNlLCBvcmlnLCBkZXN0LCBtZXRhKTtcclxuICAgIGNvbnN0IG5vX2dhdGUgPSBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZV1cclxuICAgIGlmICgocGllY2UuY29sb3IgPT09IFwid2hpdGVcIiAmJiBvcmlnLnNsaWNlKDEpICE9PSBcIjFcIikgfHxcclxuICAgICAgICAocGllY2UuY29sb3IgPT09IFwiYmxhY2tcIiAmJiBvcmlnLnNsaWNlKDEpICE9PSBcIjhcIikgfHxcclxuICAgICAgICAocGllY2Uucm9sZSA9PT0gXCJoYXdrXCIpIHx8XHJcbiAgICAgICAgKHBpZWNlLnJvbGUgPT09IFwiZWxlcGhhbnRcIikpIHJldHVybiBub19nYXRlO1xyXG5cclxuICAgIC8vIEluIHN0YXJ0aW5nIHBvc2l0aW9uIGtpbmcgYW5kKCEpIHJvb2sgdmlyZ2luaXR5IGlzIGVuY29kZWQgaW4gS1FrcVxyXG4gICAgLy8gXCJybmJxa2Juci9wcHBwcHBwcC84LzgvOC84L1BQUFBQUFBQL1JOQlFLQk5SW0hFaGVdIHcgS1FCQ0RGR2txYmNkZmcgLSAwIDFcIlxyXG5cclxuICAgIC8vIGJ1dCBhZnRlciBraW5ncyBtb3ZlZCByb29rIHZpcmdpbml0eSBpcyBlbmNvZGVkIGluIEFIYWhcclxuICAgIC8vIHJuYnExYm5yL3BwcHBrcHBwLzgvNHAzLzRQMy84L1BQUFBLUFBQL1JOQlExQk5SW0hFaGVdIHcgQUJDREZHSGFiY2RmZ2ggLSAyIDNcclxuXHJcbiAgICAvLyBraW5nIHZpcmdpbml0eSBpcyBlbmNvZGVkIGluIEVlIGFmdGVyIGFueSBSb29rIG1vdmVkIGJ1dCBLaW5nIG5vdFxyXG5cclxuICAgIGNvbnN0IHBhcnRzID0gZmVuLnNwbGl0KFwiIFwiKTtcclxuICAgIGNvbnN0IHBsYWNlbWVudCA9IHBhcnRzWzBdO1xyXG4gICAgY29uc3QgY29sb3IgPSBwYXJ0c1sxXTtcclxuICAgIGNvbnN0IGNhc3RsID0gcGFydHNbMl07XHJcbiAgICAvLyBjb25zb2xlLmxvZyhcImlzR2F0aW5nKClcIiwgb3JpZywgcGxhY2VtZW50LCBjb2xvciwgY2FzdGwpO1xyXG4gICAgc3dpdGNoIChvcmlnKSB7XHJcbiAgICBjYXNlIFwiYTFcIjpcclxuICAgICAgICBpZiAoY2FzdGwuaW5kZXhPZihcIkFcIikgPT09IC0xICYmIGNhc3RsLmluZGV4T2YoXCJRXCIpID09PSAtMSkgcmV0dXJuIG5vX2dhdGU7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiYjFcIjpcclxuICAgICAgICBpZiAoY2FzdGwuaW5kZXhPZihcIkJcIikgPT09IC0xKSByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJjMVwiOlxyXG4gICAgICAgIGlmIChjYXN0bC5pbmRleE9mKFwiQ1wiKSA9PT0gLTEpIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImQxXCI6XHJcbiAgICAgICAgaWYgKGNhc3RsLmluZGV4T2YoXCJEXCIpID09PSAtMSkgcmV0dXJuIG5vX2dhdGU7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiZTFcIjpcclxuICAgICAgICBpZiAocGllY2Uucm9sZSAhPT0gXCJraW5nXCIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5vX2dhdGU7XHJcbiAgICAgICAgfSBlbHNlIGlmICgoY2FzdGwuaW5kZXhPZihcIktcIikgPT09IC0xKSAmJiAoY2FzdGwuaW5kZXhPZihcIlFcIikgPT09IC0xKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICB9IGVsc2UgaWYgKGNhc3RsLmluZGV4T2YoXCJFXCIpID09PSAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImYxXCI6XHJcbiAgICAgICAgaWYgKGNhc3RsLmluZGV4T2YoXCJGXCIpID09PSAtMSkgcmV0dXJuIG5vX2dhdGU7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiZzFcIjpcclxuICAgICAgICBpZiAoY2FzdGwuaW5kZXhPZihcIkdcIikgPT09IC0xKSByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJoMVwiOlxyXG4gICAgICAgIGlmIChjYXN0bC5pbmRleE9mKFwiSFwiKSA9PT0gLTEgJiYgY2FzdGwuaW5kZXhPZihcIktcIikgPT09IC0xKSByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJhOFwiOlxyXG4gICAgICAgIGlmIChjYXN0bC5pbmRleE9mKFwiYVwiKSA9PT0gLTEgJiYgY2FzdGwuaW5kZXhPZihcInFcIikgPT09IC0xKSByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJiOFwiOlxyXG4gICAgICAgIGlmIChjYXN0bC5pbmRleE9mKFwiYlwiKSA9PT0gLTEpIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImM4XCI6XHJcbiAgICAgICAgaWYgKGNhc3RsLmluZGV4T2YoXCJjXCIpID09PSAtMSkgcmV0dXJuIG5vX2dhdGU7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiZDhcIjpcclxuICAgICAgICBpZiAoY2FzdGwuaW5kZXhPZihcImRcIikgPT09IC0xKSByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJlOFwiOlxyXG4gICAgICAgIGlmIChwaWVjZS5yb2xlICE9PSBcImtpbmdcIikge1xyXG4gICAgICAgICAgICByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICB9IGVsc2UgaWYgKChjYXN0bC5pbmRleE9mKFwia1wiKSA9PT0gLTEpICYmIChjYXN0bC5pbmRleE9mKFwicVwiKSA9PT0gLTEpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoY2FzdGwuaW5kZXhPZihcImVcIikgPT09IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiZjhcIjpcclxuICAgICAgICBpZiAoY2FzdGwuaW5kZXhPZihcImZcIikgPT09IC0xKSByZXR1cm4gbm9fZ2F0ZTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJnOFwiOlxyXG4gICAgICAgIGlmIChjYXN0bC5pbmRleE9mKFwiZ1wiKSA9PT0gLTEpIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImg4XCI6XHJcbiAgICAgICAgaWYgKGNhc3RsLmluZGV4T2YoXCJoXCIpID09PSAtMSAmJiBjYXN0bC5pbmRleE9mKFwia1wiKSA9PT0gLTEpIHJldHVybiBub19nYXRlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfTtcclxuICAgIGNvbnN0IGJyYWNrZXRQb3MgPSBwbGFjZW1lbnQuaW5kZXhPZihcIltcIik7XHJcbiAgICBjb25zdCBwb2NrZXRzID0gcGxhY2VtZW50LnNsaWNlKGJyYWNrZXRQb3MpO1xyXG4gICAgY29uc3QgcGggPSBsYyhwb2NrZXRzLCBcImhcIiwgY29sb3I9PT0ndycpICE9PSAwO1xyXG4gICAgY29uc3QgcGUgPSBsYyhwb2NrZXRzLCBcImVcIiwgY29sb3I9PT0ndycpICE9PSAwO1xyXG4gICAgY29uc3QgcHEgPSBsYyhwb2NrZXRzLCBcInFcIiwgY29sb3I9PT0ndycpICE9PSAwO1xyXG4gICAgY29uc3QgcHIgPSBsYyhwb2NrZXRzLCBcInJcIiwgY29sb3I9PT0ndycpICE9PSAwO1xyXG4gICAgY29uc3QgcGIgPSBsYyhwb2NrZXRzLCBcImJcIiwgY29sb3I9PT0ndycpICE9PSAwO1xyXG4gICAgY29uc3QgcG4gPSBsYyhwb2NrZXRzLCBcIm5cIiwgY29sb3I9PT0ndycpICE9PSAwO1xyXG5cclxuICAgIHJldHVybiBbcGgsIHBlLCBwcSwgcHIsIHBiLCBwbl07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBpc1Byb21vdGlvbih2YXJpYW50LCBwaWVjZSwgb3JpZywgZGVzdCwgbWV0YSkge1xyXG4gICAgaWYgKHZhcmlhbnQgPT09ICd4aWFuZ3FpJykgcmV0dXJuIGZhbHNlO1xyXG4gICAgY29uc3QgcHogPSBwcm9tb3Rpb25ab25lKHZhcmlhbnQsIHBpZWNlLmNvbG9yKVxyXG4gICAgc3dpdGNoICh2YXJpYW50KSB7XHJcbiAgICBjYXNlICdzaG9naSc6XHJcbiAgICAgICAgcmV0dXJuIFsna2luZycsICdnb2xkJywgJ3BwYXduJywgJ3BrbmlnaHQnLCAncGJpc2hvcCcsICdwcm9vaycsICdwc2lsdmVyJywgJ3BsYW5jZSddLmluZGV4T2YocGllY2Uucm9sZSkgPT09IC0xXHJcbiAgICAgICAgICAgICYmIChwei5pbmRleE9mKG9yaWcpICE9PSAtMSB8fCBwei5pbmRleE9mKGRlc3QpICE9PSAtMSlcclxuICAgIGNhc2UgJ3NpdHR1eWluJzpcclxuICAgICAgICAvLyBTZWUgaHR0cHM6Ly92ZG9jdW1lbnRzLm5ldC9ob3ctdG8tcGxheS1teWFubWFyLXRyYWRpdGlvbmFsLWNoZXNzLWVuZy1ib29rLTEuaHRtbFxyXG4gICAgICAgIGNvbnN0IGZpcnN0UmFua0lzMCA9IGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IGRtID0gZGlhZ29uYWxNb3ZlKGtleTJwb3Mob3JpZywgZmlyc3RSYW5rSXMwKSwga2V5MnBvcyhkZXN0LCBmaXJzdFJhbmtJczApKTtcclxuICAgICAgICByZXR1cm4gcGllY2Uucm9sZSA9PT0gXCJwYXduXCIgJiYgKCBvcmlnID09PSBkZXN0IHx8ICghbWV0YS5jYXB0dXJlZCAmJiBkbSkpXHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJldHVybiBwaWVjZS5yb2xlID09PSBcInBhd25cIiAmJiBwei5pbmRleE9mKGRlc3QpICE9PSAtMVxyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdWNpMnVzaShtb3ZlKSB7XHJcbiAgICBjb25zdCBwYXJ0cyA9IG1vdmUuc3BsaXQoXCJcIik7XHJcbiAgICBpZiAocGFydHNbMV0gPT09IFwiQFwiKSB7XHJcbiAgICAgICAgcGFydHNbMV0gPSBcIipcIjtcclxuICAgICAgICBwYXJ0c1syXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFydHNbMl0uY2hhckNvZGVBdCgpIC0gNDgpXHJcbiAgICAgICAgcGFydHNbM10gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnRzWzNdLmNoYXJDb2RlQXQoKSArIDQ4KVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBwYXJ0c1swXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFydHNbMF0uY2hhckNvZGVBdCgpIC0gNDgpXHJcbiAgICAgICAgcGFydHNbMV0gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnRzWzFdLmNoYXJDb2RlQXQoKSArIDQ4KVxyXG4gICAgICAgIHBhcnRzWzJdID0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJ0c1syXS5jaGFyQ29kZUF0KCkgLSA0OClcclxuICAgICAgICBwYXJ0c1szXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFydHNbM10uY2hhckNvZGVBdCgpICsgNDgpXHJcbiAgICB9XHJcbiAgICByZXR1cm4gcGFydHMuam9pbihcIlwiKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHVzaTJ1Y2kobW92ZSkge1xyXG4gICAgY29uc3QgcGFydHMgPSBtb3ZlLnNwbGl0KFwiXCIpO1xyXG4gICAgaWYgKHBhcnRzWzFdID09PSBcIipcIikge1xyXG4gICAgICAgIHBhcnRzWzFdID0gXCJAXCI7XHJcbiAgICAgICAgcGFydHNbMl0gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnRzWzJdLmNoYXJDb2RlQXQoKSArIDQ4KVxyXG4gICAgICAgIHBhcnRzWzNdID0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJ0c1szXS5jaGFyQ29kZUF0KCkgLSA0OClcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcGFydHNbMF0gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnRzWzBdLmNoYXJDb2RlQXQoKSArIDQ4KVxyXG4gICAgICAgIHBhcnRzWzFdID0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJ0c1sxXS5jaGFyQ29kZUF0KCkgLSA0OClcclxuICAgICAgICBwYXJ0c1syXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFydHNbMl0uY2hhckNvZGVBdCgpICsgNDgpXHJcbiAgICAgICAgcGFydHNbM10gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnRzWzNdLmNoYXJDb2RlQXQoKSAtIDQ4KVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhcnRzLmpvaW4oXCJcIik7XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCByb2xlVG9TYW4gPSB7XHJcbiAgICBwYXduOiAnUCcsXHJcbiAgICBrbmlnaHQ6ICdOJyxcclxuICAgIGJpc2hvcDogJ0InLFxyXG4gICAgcm9vazogJ1InLFxyXG4gICAgcXVlZW46ICdRJyxcclxuICAgIGtpbmc6ICdLJyxcclxuICAgIGFyY2hiaXNob3A6ICdBJyxcclxuICAgIGNhbmNlbGxvcjogJ0MnLFxyXG4gICAgZWxlcGhhbnQ6IFwiRVwiLFxyXG4gICAgaGF3azogXCJIXCIsXHJcbiAgICBmZXJ6OiAnRicsXHJcbiAgICBtZXQ6ICdNJyxcclxuICAgIGdvbGQ6ICdHJyxcclxuICAgIHNpbHZlcjogJ1MnLFxyXG4gICAgbGFuY2U6ICdMJyxcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBzYW5Ub1JvbGUgPSB7XHJcbiAgICBQOiAncGF3bicsXHJcbiAgICBOOiAna25pZ2h0JyxcclxuICAgIEI6ICdiaXNob3AnLFxyXG4gICAgUjogJ3Jvb2snLFxyXG4gICAgUTogJ3F1ZWVuJyxcclxuICAgIEs6ICdraW5nJyxcclxuICAgIEE6ICdhcmNoYmlzaG9wJyxcclxuICAgIEM6ICdjYW5jZWxsb3InLFxyXG4gICAgRTogJ2VsZXBoYW50JyxcclxuICAgIEg6ICdoYXdrJyxcclxuICAgIEY6ICdmZXJ6JyxcclxuICAgIE06ICdtZXQnLFxyXG4gICAgRzogJ2dvbGQnLFxyXG4gICAgUzogJ3NpbHZlcicsXHJcbiAgICBMOiAnbGFuY2UnLFxyXG4gICAgcDogJ3Bhd24nLFxyXG4gICAgbjogJ2tuaWdodCcsXHJcbiAgICBiOiAnYmlzaG9wJyxcclxuICAgIHI6ICdyb29rJyxcclxuICAgIHE6ICdxdWVlbicsXHJcbiAgICBrOiAna2luZycsXHJcbiAgICBhOiAnYXJjaGJpc2hvcCcsXHJcbiAgICBjOiAnY2FuY2VsbG9yJyxcclxuICAgIGU6ICdlbGVwaGFudCcsXHJcbiAgICBoOiAnaGF3aycsXHJcbiAgICBmOiAnZmVyeicsXHJcbiAgICBtOiAnbWV0JyxcclxuICAgIGc6ICdnb2xkJyxcclxuICAgIHM6ICdzaWx2ZXInLFxyXG4gICAgbDogJ2xhbmNlJyxcclxufTtcclxuXHJcbi8vIENvdW50IGdpdmVuIGxldHRlciBvY2N1cmVuY2VzIGluIGEgc3RyaW5nXHJcbmV4cG9ydCBmdW5jdGlvbiBsYyhzdHIsIGxldHRlciwgdXBwZXJjYXNlKSB7XHJcbiAgICB2YXIgbGV0dGVyQ291bnQgPSAwO1xyXG4gICAgaWYgKHVwcGVyY2FzZSkgbGV0dGVyID0gbGV0dGVyLnRvVXBwZXJDYXNlKCk7XHJcbiAgICBmb3IgKHZhciBwb3NpdGlvbiA9IDA7IHBvc2l0aW9uIDwgc3RyLmxlbmd0aDsgcG9zaXRpb24rKykge1xyXG4gICAgICAgIGlmIChzdHIuY2hhckF0KHBvc2l0aW9uKSA9PT0gbGV0dGVyKSBsZXR0ZXJDb3VudCArPSAxO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGxldHRlckNvdW50O1xyXG59XHJcbiIsIi8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzIwNjE4MzU1L3RoZS1zaW1wbGVzdC1wb3NzaWJsZS1qYXZhc2NyaXB0LWNvdW50ZG93bi10aW1lclxuXG5pbXBvcnQgeyBoLCBpbml0IH0gZnJvbSBcInNuYWJiZG9tXCI7XG5pbXBvcnQga2xhc3MgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9jbGFzcyc7XG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xuaW1wb3J0IHByb3BlcnRpZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9wcm9wcyc7XG5pbXBvcnQgbGlzdGVuZXJzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMnO1xuXG5jb25zdCBwYXRjaCA9IGluaXQoW2tsYXNzLCBhdHRyaWJ1dGVzLCBwcm9wZXJ0aWVzLCBsaXN0ZW5lcnNdKTtcblxuZXhwb3J0IGNsYXNzIENsb2NrIHtcbiAgICBkdXJhdGlvbjogbnVtYmVyO1xuICAgIGluY3JlbWVudDogbnVtYmVyO1xuICAgIGdyYW51bGFyaXR5OiBudW1iZXI7XG4gICAgcnVubmluZzogYm9vbGVhbjtcbiAgICBjb25uZWN0aW5nOiBib29sZWFuO1xuICAgIHRpbWVvdXQ6IGFueTtcbiAgICBzdGFydFRpbWU6IGFueTtcbiAgICB0aWNrQ2FsbGJhY2tzOiBhbnlbXTtcbiAgICBmbGFnQ2FsbGJhY2s6IGFueTtcbiAgICBlbDogSFRNTEVsZW1lbnQ7XG4gICAgaWQ6IHN0cmluZztcblxuICAgIC8vIGdhbWUgYmFzZVRpbWUgKG1pbikgYW5kIGluY3JlbWVudCAoc2VjKVxuICAgIGNvbnN0cnVjdG9yKGJhc2VUaW1lLCBpbmNyZW1lbnQsIGVsLCBpZCkge1xuICAgIHRoaXMuZHVyYXRpb24gPSBiYXNlVGltZSAqIDEwMDAgKiA2MDtcbiAgICB0aGlzLmluY3JlbWVudCA9IGluY3JlbWVudCAqIDEwMDA7XG4gICAgdGhpcy5ncmFudWxhcml0eSA9IDUwMDtcbiAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICB0aGlzLmNvbm5lY3RpbmcgPSBmYWxzZTtcbiAgICB0aGlzLnRpbWVvdXQgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRUaW1lID0gbnVsbDtcbiAgICB0aGlzLnRpY2tDYWxsYmFja3MgPSBbXTtcbiAgICB0aGlzLmZsYWdDYWxsYmFjayA9IG51bGw7XG4gICAgdGhpcy5lbCA9IGVsO1xuICAgIHRoaXMuaWQgPSBpZDtcblxuICAgIHJlbmRlclRpbWUodGhpcywgdGhpcy5kdXJhdGlvbik7XG4gICAgfVxuXG4gICAgc3RhcnQgPSAoZHVyYXRpb24pID0+IHtcbiAgICAgICAgaWYgKHRoaXMucnVubmluZykgcmV0dXJuO1xuICAgICAgICBpZiAodHlwZW9mIGR1cmF0aW9uICE9PSBcInVuZGVmaW5lZFwiKSB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247XG5cbiAgICAgICAgdGhpcy5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICAgIHZhciBkaWZmO1xuXG4gICAgICAgIChmdW5jdGlvbiB0aW1lcigpIHtcbiAgICAgICAgICAgIGRpZmYgPSB0aGF0LmR1cmF0aW9uIC0gKERhdGUubm93KCkgLSB0aGF0LnN0YXJ0VGltZSk7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInRpbWVyKClcIiwgdGhhdC5kdXJhdGlvbiAtIGRpZmYpO1xuICAgICAgICAgICAgaWYgKGRpZmYgPD0gMCkge1xuICAgICAgICAgICAgICAgIHRoYXQuZmxhZ0NhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgdGhhdC5wYXVzZShmYWxzZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhhdC50aW1lb3V0ID0gc2V0VGltZW91dCh0aW1lciwgdGhhdC5ncmFudWxhcml0eSk7XG4gICAgICAgICAgICB0aGF0LnRpY2tDYWxsYmFja3MuZm9yRWFjaChmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwodGhhdCwgdGhhdCwgZGlmZik7XG4gICAgICAgICAgICB9LCB0aGF0KTtcbiAgICAgICAgfSgpKTtcbiAgICB9XG5cbiAgICBvblRpY2sgPSAoY2FsbGJhY2spID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhpcy50aWNrQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIG9uRmxhZyA9IChjYWxsYmFjaykgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aGlzLnBhdXNlKGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuZmxhZ0NhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgcGF1c2UgPSAod2l0aEluY3JlbWVudCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMucnVubmluZykgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy50aW1lb3V0KSBjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0KTtcbiAgICAgICAgdGhpcy50aW1lb3V0ID0gbnVsbDtcblxuICAgICAgICB0aGlzLmR1cmF0aW9uIC09IERhdGUubm93KCkgLSB0aGlzLnN0YXJ0VGltZTtcbiAgICAgICAgaWYgKHdpdGhJbmNyZW1lbnQgJiYgdGhpcy5pbmNyZW1lbnQpIHRoaXMuZHVyYXRpb24gKz0gdGhpcy5pbmNyZW1lbnQ7XG4gICAgICAgIHJlbmRlclRpbWUodGhpcywgdGhpcy5kdXJhdGlvbik7XG4gICAgfVxuXG4gICAgc2V0VGltZSA9IChtaWxsaXMpID0+IHtcbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IG1pbGxpcztcbiAgICAgICAgcmVuZGVyVGltZSh0aGlzLCB0aGlzLmR1cmF0aW9uKTtcbiAgICB9XG5cbiAgICBwYXJzZVRpbWUgPSAobWlsbGlzKSA9PiB7XG4gICAgICAgIGxldCBtaW51dGVzID0gTWF0aC5mbG9vcihtaWxsaXMgLyA2MDAwMCk7XG4gICAgICAgIGxldCBzZWNvbmRzID0gKG1pbGxpcyAlIDYwMDAwKSAvIDEwMDA7XG4gICAgICAgIGxldCBzZWNzLCBtaW5zO1xuICAgICAgICBpZiAoTWF0aC5mbG9vcihzZWNvbmRzKSA9PSA2MCkge1xuICAgICAgICAgICAgbWludXRlcysrO1xuICAgICAgICAgICAgc2Vjb25kcyA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgbWludXRlcyA9IE1hdGgubWF4KDAsIG1pbnV0ZXMpO1xuICAgICAgICBzZWNvbmRzID0gTWF0aC5tYXgoMCwgc2Vjb25kcyk7XG4gICAgICAgIGlmIChtaWxsaXMgPCAxMDAwMCkge1xuICAgICAgICAgICAgc2VjcyA9IHNlY29uZHMudG9GaXhlZCgxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlY3MgPSBTdHJpbmcoTWF0aC5mbG9vcihzZWNvbmRzKSk7XG4gICAgICAgIH1cbiAgICAgICAgbWlucyA9IChtaW51dGVzIDwgMTAgPyBcIjBcIiA6IFwiXCIpICsgU3RyaW5nKG1pbnV0ZXMpO1xuICAgICAgICBzZWNzID0gKHNlY29uZHMgPCAxMCA/IFwiMFwiIDogXCJcIikgKyBzZWNzO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbWludXRlczogbWlucyxcbiAgICAgICAgICAgIHNlY29uZHM6IHNlY3MsXG4gICAgICAgIH07XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyVGltZShjbG9jaywgdGltZSkge1xuICAgIGlmIChjbG9jay5ncmFudWxhcml0eSA+IDEwMCAmJiB0aW1lIDwgMTAwMDApIGNsb2NrLmdyYW51bGFyaXR5ID0gMTAwO1xuICAgIGNvbnN0IHBhcnNlZCA9IGNsb2NrLnBhcnNlVGltZSh0aW1lKTtcbiAgICAvLyBjb25zb2xlLmxvZyhcInJlbmRlclRpbWUoKTpcIiwgdGltZSwgcGFyc2VkKTtcblxuICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh0aW1lKTtcbiAgICBjb25zdCBtaWxsaXMgPSBkYXRlLmdldFVUQ01pbGxpc2Vjb25kcygpO1xuICAgIGNsb2NrLmVsID0gcGF0Y2goY2xvY2suZWwsIGgoJ2Rpdi5jbG9jay13cmFwIycgKyBjbG9jay5pZCwgW1xuICAgICAgICBoKCdkaXYuY2xvY2snLCBbXG4gICAgICAgICAgICBoKCdkaXYuY2xvY2sudGltZS5taW4nLCB7Y2xhc3M6IHtydW5uaW5nOiBjbG9jay5ydW5uaW5nLCBodXJyeTogdGltZSA8IDEwMDAwLCBjb25uZWN0aW5nOiBjbG9jay5jb25uZWN0aW5nfX0sIHBhcnNlZC5taW51dGVzKSxcbiAgICAgICAgICAgIGgoJ2Rpdi5jbG9jay5zZXAnLCB7Y2xhc3M6IHtydW5uaW5nOiBjbG9jay5ydW5uaW5nLCBodXJyeTogdGltZSA8IDEwMDAwLCBsb3c6IG1pbGxpcyA8IDUwMCwgY29ubmVjdGluZzogY2xvY2suY29ubmVjdGluZ319ICwgJzonKSxcbiAgICAgICAgICAgIGgoJ2Rpdi5jbG9jay50aW1lLnNlYycsIHtjbGFzczoge3J1bm5pbmc6IGNsb2NrLnJ1bm5pbmcsIGh1cnJ5OiB0aW1lIDwgMTAwMDAsIGNvbm5lY3Rpbmc6IGNsb2NrLmNvbm5lY3Rpbmd9fSwgcGFyc2VkLnNlY29uZHMpXG4gICAgICAgIF0pXG4gICAgXSlcbiAgICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGltZWFnbyhkYXRlKSB7XG4gICAgY29uc3QgVFpkYXRlID0gbmV3IERhdGUoZGF0ZSArICdaJyk7XG4gICAgdmFyIHZhbCA9IDAgfCAoRGF0ZS5ub3coKSAtIFRaZGF0ZS5nZXRUaW1lKCkpIC8gMTAwMDtcbiAgICB2YXIgdW5pdCwgbGVuZ3RoID0geyBzZWNvbmQ6IDYwLCBtaW51dGU6IDYwLCBob3VyOiAyNCwgZGF5OiA3LCB3ZWVrOiA0LjM1LFxuICAgICAgICBtb250aDogMTIsIHllYXI6IDEwMDAwIH0sIHJlc3VsdDtcbiBcbiAgICBmb3IgKHVuaXQgaW4gbGVuZ3RoKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbCAlIGxlbmd0aFt1bml0XTtcbiAgICAgICAgaWYgKCEodmFsID0gMCB8IHZhbCAvIGxlbmd0aFt1bml0XSkpXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0ICsgJyAnICsgKHJlc3VsdC0xID8gdW5pdCArICdzJyA6IHVuaXQpICsgJyBhZ28nO1xuICAgIH1cbiAgICByZXR1cm4gJyc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJUaW1lYWdvKCkge1xuICAgIHZhciB4ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJpbmZvLWRhdGVcIik7XG4gICAgdmFyIGk7XG4gICAgZm9yIChpID0gMDsgaSA8IHgubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgeFtpXS5pbm5lckhUTUwgPSB0aW1lYWdvKHhbaV0uZ2V0QXR0cmlidXRlKCd0aW1lc3RhbXAnKSk7XG4gICAgfVxuICAgIHNldFRpbWVvdXQocmVuZGVyVGltZWFnbywgMTIwMCk7XG59IiwiaW1wb3J0IFNvY2tldHRlIGZyb20gJ3NvY2tldHRlJztcclxuXHJcbmltcG9ydCB7IGluaXQgfSBmcm9tICdzbmFiYmRvbSc7XHJcbmltcG9ydCB7IGggfSBmcm9tICdzbmFiYmRvbS9oJztcclxuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xyXG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xyXG5pbXBvcnQgcHJvcGVydGllcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJztcclxuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcclxuXHJcbmltcG9ydCB7IGtleTJwb3MsIHBvczJrZXkgfSBmcm9tICdjaGVzc2dyb3VuZHgvdXRpbCc7XHJcbmltcG9ydCB7IENoZXNzZ3JvdW5kIH0gZnJvbSAnY2hlc3Nncm91bmR4JztcclxuaW1wb3J0IHsgQXBpIH0gZnJvbSAnY2hlc3Nncm91bmR4L2FwaSc7XHJcbmltcG9ydCB7IENvbG9yLCBEZXN0cywgUGllY2VzRGlmZiwgUm9sZSwgS2V5LCBQb3MsIFBpZWNlLCBkaW1lbnNpb25zIH0gZnJvbSAnY2hlc3Nncm91bmR4L3R5cGVzJztcclxuXHJcbmltcG9ydCB7IENsb2NrLCByZW5kZXJUaW1lIH0gZnJvbSAnLi9jbG9jayc7XHJcbmltcG9ydCBtYWtlR2F0aW5nIGZyb20gJy4vZ2F0aW5nJztcclxuaW1wb3J0IG1ha2VQcm9tb3Rpb24gZnJvbSAnLi9wcm9tb3Rpb24nO1xyXG5pbXBvcnQgeyBkcm9wSXNWYWxpZCwgcG9ja2V0VmlldywgdXBkYXRlUG9ja2V0cyB9IGZyb20gJy4vcG9ja2V0JztcclxuaW1wb3J0IHsgc291bmQsIGNoYW5nZUNTUyB9IGZyb20gJy4vc291bmQnO1xyXG5pbXBvcnQgeyB2YXJpYW50cywgaGFzRXAsIG5lZWRQb2NrZXRzLCByb2xlVG9TYW4sIHVjaTJ1c2ksIHVzaTJ1Y2ksIFZBUklBTlRTIH0gZnJvbSAnLi9jaGVzcyc7XHJcbmltcG9ydCB7IHJlbmRlclVzZXJuYW1lIH0gZnJvbSAnLi91c2VyJztcclxuaW1wb3J0IHsgY2hhdE1lc3NhZ2UsIGNoYXRWaWV3IH0gZnJvbSAnLi9jaGF0JztcclxuaW1wb3J0IHsgbW92ZWxpc3RWaWV3LCB1cGRhdGVNb3ZlbGlzdCB9IGZyb20gJy4vbW92ZWxpc3QnO1xyXG5pbXBvcnQgcmVzaXplSGFuZGxlIGZyb20gJy4vcmVzaXplJztcclxuaW1wb3J0IHsgcmVzdWx0IH0gZnJvbSAnLi9wcm9maWxlJ1xyXG5cclxuY29uc3QgcGF0Y2ggPSBpbml0KFtrbGFzcywgYXR0cmlidXRlcywgcHJvcGVydGllcywgbGlzdGVuZXJzXSk7XHJcblxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUm91bmRDb250cm9sbGVyIHtcclxuICAgIG1vZGVsO1xyXG4gICAgc29jaztcclxuICAgIGNoZXNzZ3JvdW5kOiBBcGk7XHJcbiAgICBmdWxsZmVuOiBzdHJpbmc7XHJcbiAgICB3cGxheWVyOiBzdHJpbmc7XHJcbiAgICBicGxheWVyOiBzdHJpbmc7XHJcbiAgICBiYXNlOiBudW1iZXI7XHJcbiAgICBpbmM6IG51bWJlcjtcclxuICAgIG15Y29sb3I6IENvbG9yO1xyXG4gICAgb3BwY29sb3I6IENvbG9yO1xyXG4gICAgdHVybkNvbG9yOiBDb2xvcjtcclxuICAgIGNsb2NrczogYW55O1xyXG4gICAgYWJvcnRhYmxlOiBib29sZWFuO1xyXG4gICAgZ2FtZUlkOiBzdHJpbmc7XHJcbiAgICB2YXJpYW50OiBzdHJpbmc7XHJcbiAgICBwb2NrZXRzOiBhbnk7XHJcbiAgICB2cG9ja2V0MDogYW55O1xyXG4gICAgdnBvY2tldDE6IGFueTtcclxuICAgIGdhbWVDb250cm9sczogYW55O1xyXG4gICAgbW92ZUNvbnRyb2xzOiBhbnk7XHJcbiAgICBnYXRpbmc6IGFueTtcclxuICAgIHByb21vdGlvbjogYW55O1xyXG4gICAgZGVzdHM6IERlc3RzO1xyXG4gICAgbGFzdG1vdmU6IEtleVtdO1xyXG4gICAgcHJlbW92ZTogYW55O1xyXG4gICAgcHJlZHJvcDogYW55O1xyXG4gICAgcmVzdWx0OiBzdHJpbmc7XHJcbiAgICBmbGlwOiBib29sZWFuO1xyXG4gICAgc3BlY3RhdG9yOiBib29sZWFuO1xyXG4gICAgb3BwSXNSYW5kb21Nb3ZlcjogYm9vbGVhbjtcclxuICAgIHR2OiBib29sZWFuO1xyXG4gICAgc3RhdHVzOiBudW1iZXI7XHJcbiAgICBzdGVwcztcclxuICAgIHBseTogbnVtYmVyO1xyXG4gICAgcGxheWVyczogc3RyaW5nW107XHJcbiAgICBDU1NpbmRleGVzOiBudW1iZXJbXTtcclxuICAgIGNsaWNrRHJvcDogUGllY2UgfCB1bmRlZmluZWQ7XHJcblxyXG4gICAgY29uc3RydWN0b3IoZWwsIG1vZGVsKSB7XHJcbiAgICAgICAgY29uc3Qgb25PcGVuID0gKGV2dCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImN0cmwub25PcGVuKClcIiwgZXZ0KTtcclxuICAgICAgICAgICAgdGhpcy5jbG9ja3NbMF0uY29ubmVjdGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICB0aGlzLmNsb2Nrc1sxXS5jb25uZWN0aW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJnYW1lX3VzZXJfY29ubmVjdGVkXCIsIHVzZXJuYW1lOiB0aGlzLm1vZGVsW1widXNlcm5hbWVcIl0sIGdhbWVJZDogdGhpcy5tb2RlbFtcImdhbWVJZFwiXSB9KTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBjb25zdCBvcHRzID0ge1xyXG4gICAgICAgICAgICBtYXhBdHRlbXB0czogMTAsXHJcbiAgICAgICAgICAgIG9ub3BlbjogZSA9PiBvbk9wZW4oZSksXHJcbiAgICAgICAgICAgIG9ubWVzc2FnZTogZSA9PiB0aGlzLm9uTWVzc2FnZShlKSxcclxuICAgICAgICAgICAgb25yZWNvbm5lY3Q6IGUgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9ja3NbMF0uY29ubmVjdGluZyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNsb2Nrc1sxXS5jb25uZWN0aW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdSZWNvbm5lY3RpbmcgaW4gcm91bmQuLi4nLCBlKTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JvdHRvbS1wbGF5ZXInKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgnaS1zaWRlLm9ubGluZSNib3R0b20tcGxheWVyJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1vbmxpbmVcIjogZmFsc2UsIFwiaWNvbi1vZmZsaW5lXCI6IHRydWV9fSkpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgb25tYXhpbXVtOiBlID0+IGNvbnNvbGUubG9nKCdTdG9wIEF0dGVtcHRpbmchJywgZSksXHJcbiAgICAgICAgICAgIG9uY2xvc2U6IGUgPT4gY29uc29sZS5sb2coJ0Nsb3NlZCEnLCBlKSxcclxuICAgICAgICAgICAgb25lcnJvcjogZSA9PiBjb25zb2xlLmxvZygnRXJyb3I6JywgZSksXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHRoaXMuc29jayA9IG5ldyBTb2NrZXR0ZShcIndzOi8vXCIgKyBsb2NhdGlvbi5ob3N0ICsgXCIvd3NyXCIsIG9wdHMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgdGhpcy5zb2NrID0gbmV3IFNvY2tldHRlKFwid3NzOi8vXCIgKyBsb2NhdGlvbi5ob3N0ICsgXCIvd3NyXCIsIG9wdHMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5tb2RlbCA9IG1vZGVsO1xyXG4gICAgICAgIHRoaXMudmFyaWFudCA9IG1vZGVsW1widmFyaWFudFwiXSBhcyBzdHJpbmc7XHJcbiAgICAgICAgdGhpcy5mdWxsZmVuID0gbW9kZWxbXCJmZW5cIl0gYXMgc3RyaW5nO1xyXG4gICAgICAgIHRoaXMud3BsYXllciA9IG1vZGVsW1wid3BsYXllclwiXSBhcyBzdHJpbmc7XHJcbiAgICAgICAgdGhpcy5icGxheWVyID0gbW9kZWxbXCJicGxheWVyXCJdIGFzIHN0cmluZztcclxuICAgICAgICB0aGlzLmJhc2UgPSBtb2RlbFtcImJhc2VcIl0gYXMgbnVtYmVyO1xyXG4gICAgICAgIHRoaXMuaW5jID0gbW9kZWxbXCJpbmNcIl0gYXMgbnVtYmVyO1xyXG4gICAgICAgIHRoaXMuc3RhdHVzID0gbW9kZWxbXCJzdGF0dXNcIl0gYXMgbnVtYmVyO1xyXG4gICAgICAgIHRoaXMudHYgPSBtb2RlbFtcInR2XCJdO1xyXG4gICAgICAgIHRoaXMuc3RlcHMgPSBbXTtcclxuICAgICAgICB0aGlzLnBseSA9IDA7XHJcblxyXG4gICAgICAgIHRoaXMuZmxpcCA9IGZhbHNlO1xyXG5cclxuICAgICAgICB0aGlzLkNTU2luZGV4ZXMgPSB2YXJpYW50cy5tYXAoKHZhcmlhbnQpID0+IGxvY2FsU3RvcmFnZVt2YXJpYW50ICsgXCJfcGllY2VzXCJdID09PSB1bmRlZmluZWQgPyAwIDogTnVtYmVyKGxvY2FsU3RvcmFnZVt2YXJpYW50ICsgXCJfcGllY2VzXCJdKSk7XHJcblxyXG4gICAgICAgIHRoaXMuc3BlY3RhdG9yID0gdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdICE9PSB0aGlzLndwbGF5ZXIgJiYgdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdICE9PSB0aGlzLmJwbGF5ZXI7XHJcblxyXG4gICAgICAgIC8vIG9yaWVudGF0aW9uID0gdGhpcy5teWNvbG9yXHJcbiAgICAgICAgaWYgKHRoaXMuc3BlY3RhdG9yKSB7XHJcbiAgICAgICAgICAgIHRoaXMubXljb2xvciA9IHRoaXMudmFyaWFudCA9PT0gJ3Nob2dpJyA/ICdibGFjaycgOiAnd2hpdGUnO1xyXG4gICAgICAgICAgICB0aGlzLm9wcGNvbG9yID0gdGhpcy52YXJpYW50ID09PSAnc2hvZ2knID8gJ3doaXRlJyA6ICdibGFjayc7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5teWNvbG9yID0gdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdID09PSB0aGlzLndwbGF5ZXIgPyAnd2hpdGUnIDogJ2JsYWNrJztcclxuICAgICAgICAgICAgdGhpcy5vcHBjb2xvciA9IHRoaXMubW9kZWxbXCJ1c2VybmFtZVwiXSA9PT0gdGhpcy53cGxheWVyID8gJ2JsYWNrJyA6ICd3aGl0ZSc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm9wcElzUmFuZG9tTW92ZXIgPSAoXHJcbiAgICAgICAgICAgICh0aGlzLm15Y29sb3IgPT09IFwid2hpdGVcIiAmJiB0aGlzLmJwbGF5ZXIgPT09IFwiUmFuZG9tLU1vdmVyXCIpIHx8XHJcbiAgICAgICAgICAgICh0aGlzLm15Y29sb3IgPT09IFwiYmxhY2tcIiAmJiB0aGlzLndwbGF5ZXIgPT09IFwiUmFuZG9tLU1vdmVyXCIpKTtcclxuXHJcbiAgICAgICAgLy8gcGxheWVyc1swXSBpcyB0b3AgcGxheWVyLCBwbGF5ZXJzWzFdIGlzIGJvdHRvbSBwbGF5ZXJcclxuICAgICAgICB0aGlzLnBsYXllcnMgPSBbXHJcbiAgICAgICAgICAgIHRoaXMubXljb2xvciA9PT0gXCJ3aGl0ZVwiID8gdGhpcy5icGxheWVyIDogdGhpcy53cGxheWVyLFxyXG4gICAgICAgICAgICB0aGlzLm15Y29sb3IgPT09IFwid2hpdGVcIiA/IHRoaXMud3BsYXllciA6IHRoaXMuYnBsYXllclxyXG4gICAgICAgIF07XHJcblxyXG4gICAgICAgIHRoaXMucHJlbW92ZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5wcmVkcm9wID0gbnVsbDtcclxuXHJcbiAgICAgICAgdGhpcy5yZXN1bHQgPSBcIlwiO1xyXG4gICAgICAgIGNvbnN0IHBhcnRzID0gdGhpcy5mdWxsZmVuLnNwbGl0KFwiIFwiKTtcclxuICAgICAgICB0aGlzLmFib3J0YWJsZSA9IE51bWJlcihwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSkgPD0gMTtcclxuXHJcbiAgICAgICAgY29uc3QgZmVuX3BsYWNlbWVudCA9IHBhcnRzWzBdO1xyXG4gICAgICAgIHRoaXMudHVybkNvbG9yID0gcGFydHNbMV0gPT09IFwid1wiID8gXCJ3aGl0ZVwiIDogXCJibGFja1wiO1xyXG5cclxuICAgICAgICBpZiAoVkFSSUFOVFNbdGhpcy52YXJpYW50XS5jc3MubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICB0aGlzLnNldFBpZWNlcyh0aGlzLm15Y29sb3IpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNoYW5nZUNTUygnL3N0YXRpYy8nICsgVkFSSUFOVFNbdGhpcy52YXJpYW50XS5jc3NbMF0gKyAnLmNzcycpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuc3RlcHMucHVzaCh7XHJcbiAgICAgICAgICAgICdmZW4nOiBmZW5fcGxhY2VtZW50LFxyXG4gICAgICAgICAgICAnbW92ZSc6IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgJ2NoZWNrJzogZmFsc2UsXHJcbiAgICAgICAgICAgICd0dXJuQ29sb3InOiB0aGlzLnR1cm5Db2xvcixcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuY2hlc3Nncm91bmQgPSBDaGVzc2dyb3VuZChlbCwge1xyXG4gICAgICAgICAgICBmZW46IGZlbl9wbGFjZW1lbnQsXHJcbiAgICAgICAgICAgIGdlb21ldHJ5OiBWQVJJQU5UU1t0aGlzLnZhcmlhbnRdLmdlb20sXHJcbiAgICAgICAgICAgIG9yaWVudGF0aW9uOiB0aGlzLm15Y29sb3IsXHJcbiAgICAgICAgICAgIHR1cm5Db2xvcjogdGhpcy50dXJuQ29sb3IsXHJcbiAgICAgICAgICAgIGFuaW1hdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZXZlbnRzOiB7XHJcbiAgICAgICAgICAgICAgICBpbnNlcnQoZWxlbWVudHMpIHtyZXNpemVIYW5kbGUoZWxlbWVudHMpO31cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAobG9jYWxTdG9yYWdlLnpvb20gIT09IHVuZGVmaW5lZCAmJiBsb2NhbFN0b3JhZ2Uuem9vbSAhPT0gMTAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0Wm9vbShOdW1iZXIobG9jYWxTdG9yYWdlLnpvb20pKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLnNwZWN0YXRvcikge1xyXG4gICAgICAgICAgICB0aGlzLmNoZXNzZ3JvdW5kLnNldCh7XHJcbiAgICAgICAgICAgICAgICB2aWV3T25seTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGV2ZW50czoge1xyXG4gICAgICAgICAgICAgICAgICAgIG1vdmU6IHRoaXMub25Nb3ZlKCksXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2hlc3Nncm91bmQuc2V0KHtcclxuICAgICAgICAgICAgICAgIG1vdmFibGU6IHtcclxuICAgICAgICAgICAgICAgICAgICBmcmVlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBjb2xvcjogdGhpcy5teWNvbG9yLFxyXG4gICAgICAgICAgICAgICAgICAgIHNob3dEZXN0czogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBldmVudHM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWZ0ZXI6IHRoaXMub25Vc2VyTW92ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWZ0ZXJOZXdQaWVjZTogdGhpcy5vblVzZXJEcm9wLFxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBwcmVtb3ZhYmxlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBldmVudHM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0OiB0aGlzLnNldFByZW1vdmUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuc2V0OiB0aGlzLnVuc2V0UHJlbW92ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHByZWRyb3BwYWJsZToge1xyXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldDogdGhpcy5zZXRQcmVkcm9wLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB1bnNldDogdGhpcy51bnNldFByZWRyb3AsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBldmVudHM6IHtcclxuICAgICAgICAgICAgICAgICAgICBtb3ZlOiB0aGlzLm9uTW92ZSgpLFxyXG4gICAgICAgICAgICAgICAgICAgIGRyb3BOZXdQaWVjZTogdGhpcy5vbkRyb3AoKSxcclxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2U6IHRoaXMub25DaGFuZ2UodGhpcy5jaGVzc2dyb3VuZC5zdGF0ZS5zZWxlY3RlZCksXHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZWN0OiB0aGlzLm9uU2VsZWN0KHRoaXMuY2hlc3Nncm91bmQuc3RhdGUuc2VsZWN0ZWQpLFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLmdhdGluZyA9IG1ha2VHYXRpbmcodGhpcyk7XHJcbiAgICAgICAgdGhpcy5wcm9tb3Rpb24gPSBtYWtlUHJvbW90aW9uKHRoaXMpO1xyXG5cclxuICAgICAgICAvLyBpbml0aWFsaXplIHBvY2tldHNcclxuICAgICAgICBpZiAobmVlZFBvY2tldHModGhpcy52YXJpYW50KSkge1xyXG4gICAgICAgICAgICBjb25zdCBwb2NrZXQwID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BvY2tldDAnKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgcG9ja2V0MSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwb2NrZXQxJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIHVwZGF0ZVBvY2tldHModGhpcywgcG9ja2V0MCwgcG9ja2V0MSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBpbml0aWFsaXplIGNsb2Nrc1xyXG4gICAgICAgIGNvbnN0IGMwID0gbmV3IENsb2NrKHRoaXMuYmFzZSwgdGhpcy5pbmMsIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbG9jazAnKSBhcyBIVE1MRWxlbWVudCwgJ2Nsb2NrMCcpO1xyXG4gICAgICAgIGNvbnN0IGMxID0gbmV3IENsb2NrKHRoaXMuYmFzZSwgdGhpcy5pbmMsIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbG9jazEnKSBhcyBIVE1MRWxlbWVudCwgJ2Nsb2NrMScpO1xyXG4gICAgICAgIHRoaXMuY2xvY2tzID0gW2MwLCBjMV07XHJcbiAgICAgICAgdGhpcy5jbG9ja3NbMF0ub25UaWNrKHJlbmRlclRpbWUpO1xyXG4gICAgICAgIHRoaXMuY2xvY2tzWzFdLm9uVGljayhyZW5kZXJUaW1lKTtcclxuXHJcbiAgICAgICAgY29uc3Qgb25Nb3JlVGltZSA9ICgpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMubW9kZWxbJ3d0aXRsZSddID09PSAnQk9UJyB8fCB0aGlzLm1vZGVsWydidGl0bGUnXSA9PT0gJ0JPVCcgfHwgdGhpcy5zcGVjdGF0b3IpIHJldHVybjtcclxuICAgICAgICAgICAgdGhpcy5jbG9ja3NbMF0uc2V0VGltZSh0aGlzLmNsb2Nrc1swXS5kdXJhdGlvbiArIDE1ICogMTAwMCk7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJtb3JldGltZVwiLCBnYW1lSWQ6IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0gfSk7XHJcbiAgICAgICAgICAgIGNoYXRNZXNzYWdlKCcnLCB0aGlzLm9wcGNvbG9yICsgJyArMTUgc2Vjb25kcycsIFwicm91bmRjaGF0XCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbG9jazAnKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2Rpdi5jbG9jay13cmFwI2Nsb2NrMCcsIFtcclxuICAgICAgICAgICAgaCgnZGl2Lm1vcmUtdGltZScsIFtcclxuICAgICAgICAgICAgICAgIGgoJ2J1dHRvbi5pY29uLmljb24tcGx1cy1zcXVhcmUnLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcHM6IHt0eXBlOiBcImJ1dHRvblwiLCB0aXRsZTogXCJHaXZlIDE1IHNlY29uZHNcIn0sXHJcbiAgICAgICAgICAgICAgICAgICAgb246IHtjbGljazogKCkgPT4gb25Nb3JlVGltZSgpIH1cclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIF0pXHJcbiAgICAgICAgXSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBjb25zdCBmbGFnQ2FsbGJhY2sgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnR1cm5Db2xvciA9PT0gdGhpcy5teWNvbG9yICYmICF0aGlzLnNwZWN0YXRvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVzc2dyb3VuZC5zdG9wKCk7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkZsYWdcIik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRvU2VuZCh7IHR5cGU6IFwiZmxhZ1wiLCBnYW1lSWQ6IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0gfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5jbG9ja3NbMV0ub25GbGFnKGZsYWdDYWxsYmFjayk7XHJcblxyXG4gICAgICAgIGlmIChOdW1iZXIodGhpcy5zdGF0dXMpIDwgMCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkdBTUUgaXMgT05HT0lORy4uLlwiKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkdBTUUgd2FzIEVOREVELi4uXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gVE9ETzogYWRkIGRhcmsvbGlnaHQgdGhlbWUgYnV0dG9ucyAoaWNvbi1zdW4tby9pY29uLW1vb24tbylcclxuXHJcbiAgICAgICAgY29uc3QgdG9nZ2xlUGllY2VzID0gKCkgPT4ge1xyXG4gICAgICAgICAgICB2YXIgaWR4ID0gdGhpcy5DU1NpbmRleGVzW3ZhcmlhbnRzLmluZGV4T2YodGhpcy52YXJpYW50KV07XHJcbiAgICAgICAgICAgIGlkeCArPSAxO1xyXG4gICAgICAgICAgICBpZHggPSBpZHggJSBWQVJJQU5UU1t0aGlzLnZhcmlhbnRdLmNzcy5sZW5ndGg7XHJcbiAgICAgICAgICAgIHRoaXMuQ1NTaW5kZXhlc1t2YXJpYW50cy5pbmRleE9mKHRoaXMudmFyaWFudCldID0gaWR4XHJcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMudmFyaWFudCArIFwiX3BpZWNlc1wiLCBTdHJpbmcoaWR4KSk7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0UGllY2VzKHRoaXMubXljb2xvcik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoVkFSSUFOVFNbdGhpcy52YXJpYW50XS5jc3MubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1waWVjZXMnKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgcGF0Y2goY29udGFpbmVyLCBoKCdidXR0b24nLCB7IG9uOiB7IGNsaWNrOiAoKSA9PiB0b2dnbGVQaWVjZXMoKSB9LCBwcm9wczoge3RpdGxlOiAnVG9nZ2xlIHBpZWNlcyd9IH0sIFtoKCdpJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1jb2dcIjogdHJ1ZX0gfSApLCBdKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3pvb20nKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2lucHV0JywgeyBjbGFzczoge1wic2xpZGVyXCI6IHRydWUgfSxcclxuICAgICAgICAgICAgYXR0cnM6IHsgd2lkdGg6ICcyODBweCcsIHR5cGU6ICdyYW5nZScsIHZhbHVlOiBOdW1iZXIobG9jYWxTdG9yYWdlLnpvb20pLCBtaW46IDYwLCBtYXg6IDE0MCB9LFxyXG4gICAgICAgICAgICBvbjogeyBpbnB1dDogKGUpID0+IHsgdGhpcy5zZXRab29tKHBhcnNlRmxvYXQoKGUudGFyZ2V0IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKSk7IH0gfSB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIC8vY29uc3Qgb25SZXNpemUgPSAoKSA9PiB7Y29uc29sZS5sb2coXCJvblJlc2l6ZSgpXCIpO31cclxuICAgICAgICAvL3ZhciBlbG1udCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjZ3dyYXAnKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAvL2VsbW50LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgb25SZXNpemUpO1xyXG5cclxuICAgICAgICBjb25zdCBhYm9ydCA9ICgpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJBYm9ydFwiKTtcclxuICAgICAgICAgICAgdGhpcy5kb1NlbmQoeyB0eXBlOiBcImFib3J0XCIsIGdhbWVJZDogdGhpcy5tb2RlbFtcImdhbWVJZFwiXSB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGRyYXcgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRHJhd1wiKTtcclxuICAgICAgICAgICAgdGhpcy5kb1NlbmQoeyB0eXBlOiBcImRyYXdcIiwgZ2FtZUlkOiB0aGlzLm1vZGVsW1wiZ2FtZUlkXCJdIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcmVzaWduID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIlJlc2lnblwiKTtcclxuICAgICAgICAgICAgdGhpcy5kb1NlbmQoeyB0eXBlOiBcInJlc2lnblwiLCBnYW1lSWQ6IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0gfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dhbWUtY29udHJvbHMnKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICBpZiAoIXRoaXMuc3BlY3RhdG9yKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZ2FtZUNvbnRyb2xzID0gcGF0Y2goY29udGFpbmVyLCBoKCdkaXYuYnRuLWNvbnRyb2xzJywgW1xyXG4gICAgICAgICAgICAgICAgaCgnYnV0dG9uI2Fib3J0JywgeyBvbjogeyBjbGljazogKCkgPT4gYWJvcnQoKSB9LCBwcm9wczoge3RpdGxlOiAnQWJvcnQnfSB9LCBbaCgnaScsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tYWJvcnRcIjogdHJ1ZX0gfSApLCBdKSxcclxuICAgICAgICAgICAgICAgIGgoJ2J1dHRvbiNkcmF3JywgeyBvbjogeyBjbGljazogKCkgPT4gZHJhdygpIH0sIHByb3BzOiB7dGl0bGU6IFwiRHJhd1wifSB9LCBbaCgnaScsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24taGFuZC1wYXBlci1vXCI6IHRydWV9IH0gKSwgXSksXHJcbiAgICAgICAgICAgICAgICBoKCdidXR0b24jcmVzaWduJywgeyBvbjogeyBjbGljazogKCkgPT4gcmVzaWduKCkgfSwgcHJvcHM6IHt0aXRsZTogXCJSZXNpZ25cIn0gfSwgW2goJ2knLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLWZsYWctb1wiOiB0cnVlfSB9ICksIF0pLFxyXG4gICAgICAgICAgICAgICAgXSlcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmdhbWVDb250cm9scyA9IHBhdGNoKGNvbnRhaW5lciwgaCgnZGl2JykpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcGF0Y2goZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21vdmVsaXN0JykgYXMgSFRNTEVsZW1lbnQsIG1vdmVsaXN0Vmlldyh0aGlzKSk7XHJcblxyXG4gICAgICAgIHBhdGNoKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyb3VuZGNoYXQnKSBhcyBIVE1MRWxlbWVudCwgY2hhdFZpZXcodGhpcywgXCJyb3VuZGNoYXRcIikpO1xyXG5cclxuLy8gdGhpcyBwcm9kdWNlcyByYW5kb20gbG9zZWQgZ2FtZXMgd2hpbGUgZG9pbmcgbm90aGluZ1xyXG4vLyAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXVubG9hZCcsICgpID0+IHtcclxuLy8gICAgICAgICAgICBpZiAodGhpcy5yZXN1bHQgPT09ICcnKSB0aGlzLmRvU2VuZCh7IHR5cGU6IFwiYWJhbmRvbmVcIiwgZ2FtZUlkOiB0aGlzLm1vZGVsW1wiZ2FtZUlkXCJdIH0pO1xyXG4vLyAgICAgICAgfSk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGdldEdyb3VuZCA9ICgpID0+IHRoaXMuY2hlc3Nncm91bmQ7XHJcbiAgICBnZXREZXN0cyA9ICgpID0+IHRoaXMuZGVzdHM7XHJcblxyXG4gICAgcHJpdmF0ZSBzZXRab29tID0gKHpvb206IG51bWJlcikgPT4ge1xyXG4gICAgICAgIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNnLXdyYXAnKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICBpZiAoZWwpIHtcclxuICAgICAgICAgICAgY29uc3QgYmFzZVdpZHRoID0gZGltZW5zaW9uc1tWQVJJQU5UU1t0aGlzLnZhcmlhbnRdLmdlb21dLndpZHRoICogKHRoaXMudmFyaWFudCA9PT0gXCJzaG9naVwiID8gNTIgOiA2NCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGJhc2VIZWlnaHQgPSBkaW1lbnNpb25zW1ZBUklBTlRTW3RoaXMudmFyaWFudF0uZ2VvbV0uaGVpZ2h0ICogKHRoaXMudmFyaWFudCA9PT0gXCJzaG9naVwiID8gNjAgOiA2NCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHB4dyA9IGAke3pvb20gLyAxMDAgKiBiYXNlV2lkdGh9cHhgO1xyXG4gICAgICAgICAgICBjb25zdCBweGggPSBgJHt6b29tIC8gMTAwICogYmFzZUhlaWdodH1weGA7XHJcbiAgICAgICAgICAgIGVsLnN0eWxlLndpZHRoID0gcHh3O1xyXG4gICAgICAgICAgICBlbC5zdHlsZS5oZWlnaHQgPSBweGg7XHJcblxyXG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnNldEF0dHJpYnV0ZSgnc3R5bGUnLCAnLS1jZ3dyYXB3aWR0aDonICsgcHh3KTtcclxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywgJy0tY2d3cmFwaGVpZ2h0OicgKyBweGgpO1xyXG5cclxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnY2hlc3Nncm91bmQucmVzaXplJykpO1xyXG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcInpvb21cIiwgU3RyaW5nKHpvb20pKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ0dhbWVTdGFydCA9IChtc2cpID0+IHtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcImdvdCBnYW1lU3RhcnQgbXNnOlwiLCBtc2cpO1xyXG4gICAgICAgIGlmIChtc2cuZ2FtZUlkICE9PSB0aGlzLm1vZGVsW1wiZ2FtZUlkXCJdKSByZXR1cm47XHJcbiAgICAgICAgaWYgKCF0aGlzLnNwZWN0YXRvcikgc291bmQuZ2VuZXJpY05vdGlmeSgpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dOZXdHYW1lID0gKG1zZykgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiR2FtZUNvbnRyb2xsZXIub25Nc2dOZXdHYW1lKClcIiwgdGhpcy5tb2RlbFtcImdhbWVJZFwiXSlcclxuICAgICAgICB3aW5kb3cubG9jYXRpb24uYXNzaWduKHRoaXMubW9kZWxbXCJob21lXCJdICsgJy8nICsgbXNnW1wiZ2FtZUlkXCJdKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHJlbWF0Y2ggPSAoKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJSRU1BVENIXCIpO1xyXG4gICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJyZW1hdGNoXCIsIGdhbWVJZDogdGhpcy5tb2RlbFtcImdhbWVJZFwiXSB9KTtcclxuICAgICAgICAvLyB3aW5kb3cubG9jYXRpb24uYXNzaWduKGhvbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgbmV3T3Bwb25lbnQgPSAoaG9tZSkgPT4ge1xyXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5hc3NpZ24oaG9tZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBnYW1lT3ZlciA9ICgpID0+IHtcclxuICAgICAgICB0aGlzLmdhbWVDb250cm9scyA9IHBhdGNoKHRoaXMuZ2FtZUNvbnRyb2xzLCBoKCdkaXYnKSk7XHJcblxyXG4gICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWZ0ZXItZ2FtZScpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIGlmICh0aGlzLnNwZWN0YXRvcikge1xyXG4gICAgICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2Rpdi5hZnRlci1nYW1lJywgW2goJ3Jlc3VsdCcsIHRoaXMucmVzdWx0KV0pKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2Rpdi5hZnRlci1nYW1lJywgW1xyXG4gICAgICAgICAgICAgICAgaCgncmVzdWx0JywgcmVzdWx0KHRoaXMuc3RhdHVzLCB0aGlzLnJlc3VsdCkpLFxyXG4gICAgICAgICAgICAgICAgaCgnYnV0dG9uLnJlbWF0Y2gnLCB7IG9uOiB7IGNsaWNrOiAoKSA9PiB0aGlzLnJlbWF0Y2goKSB9IH0sIFwiUkVNQVRDSFwiKSxcclxuICAgICAgICAgICAgICAgIGgoJ2J1dHRvbi5uZXdvcHAnLCB7IG9uOiB7IGNsaWNrOiAoKSA9PiB0aGlzLm5ld09wcG9uZW50KHRoaXMubW9kZWxbXCJob21lXCJdKSB9IH0sIFwiTkVXIE9QUE9ORU5UXCIpLFxyXG4gICAgICAgICAgICBdKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY2hlY2tTdGF0dXMgPSAobXNnKSA9PiB7XHJcbiAgICAgICAgaWYgKG1zZy5nYW1lSWQgIT09IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0pIHJldHVybjtcclxuICAgICAgICBpZiAobXNnLnN0YXR1cyA+PSAwICYmIHRoaXMucmVzdWx0ID09PSBcIlwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvY2tzWzBdLnBhdXNlKGZhbHNlKTtcclxuICAgICAgICAgICAgdGhpcy5jbG9ja3NbMV0ucGF1c2UoZmFsc2UpO1xyXG4gICAgICAgICAgICB0aGlzLnJlc3VsdCA9IG1zZy5yZXN1bHQ7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhdHVzID0gbXNnLnN0YXR1cztcclxuICAgICAgICAgICAgc3dpdGNoIChtc2cucmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMS8yLTEvMlwiOlxyXG4gICAgICAgICAgICAgICAgICAgIHNvdW5kLmRyYXcoKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIxLTBcIjpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuc3BlY3RhdG9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm15Y29sb3IgPT09IFwid2hpdGVcIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc291bmQudmljdG9yeSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc291bmQuZGVmZWF0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiMC0xXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnNwZWN0YXRvcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5teWNvbG9yID09PSBcImJsYWNrXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNvdW5kLnZpY3RvcnkoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNvdW5kLmRlZmVhdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgLy8gQUJPUlRFRFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLmdhbWVPdmVyKCk7XHJcblxyXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VuZGVyLWJvYXJkJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgndW5kZXItYm9hcmQnLCBbaCgndGV4dGFyZWEnLCB7IGF0dHJzOiB7IHJvd3M6IDEzfSB9LCBtc2cucGduKV0pKTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnR2KSB7XHJcbiAgICAgICAgICAgICAgICBzZXRJbnRlcnZhbCgoKSA9PiB7dGhpcy5kb1NlbmQoeyB0eXBlOiBcInVwZGF0ZVRWXCIsIGdhbWVJZDogdGhpcy5tb2RlbFtcImdhbWVJZFwiXSB9KTt9LCAyMDAwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uTXNnVXBkYXRlVFYgPSAobXNnKSA9PiB7XHJcbiAgICAgICAgaWYgKG1zZy5nYW1lSWQgIT09IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0pIHtcclxuICAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLmFzc2lnbih0aGlzLm1vZGVsW1wiaG9tZVwiXSArICcvdHYnKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBzZXRQaWVjZXMgPSAoY29sb3IpID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcInNldFBpZWNlcygpXCIsIHRoaXMudmFyaWFudCwgY29sb3IpXHJcbiAgICAgICAgdmFyIGlkeCA9IHRoaXMuQ1NTaW5kZXhlc1t2YXJpYW50cy5pbmRleE9mKHRoaXMudmFyaWFudCldO1xyXG4gICAgICAgIGlkeCA9IE1hdGgubWluKGlkeCwgVkFSSUFOVFNbdGhpcy52YXJpYW50XS5jc3MubGVuZ3RoIC0gMSk7XHJcbiAgICAgICAgc3dpdGNoICh0aGlzLnZhcmlhbnQpIHtcclxuICAgICAgICBjYXNlIFwiY2FwYWhvdXNlXCI6XHJcbiAgICAgICAgY2FzZSBcImNhcGFibGFuY2FcIjpcclxuICAgICAgICBjYXNlIFwic2VpcmF3YW5cIjpcclxuICAgICAgICBjYXNlIFwic2hvdXNlXCI6XHJcbiAgICAgICAgY2FzZSBcInhpYW5ncWlcIjpcclxuICAgICAgICAgICAgY2hhbmdlQ1NTKCcvc3RhdGljLycgKyBWQVJJQU5UU1t0aGlzLnZhcmlhbnRdLmNzc1tpZHhdICsgJy5jc3MnKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBcInNob2dpXCI6XHJcbiAgICAgICAgICAgIHZhciBjc3MgPSBWQVJJQU5UU1t0aGlzLnZhcmlhbnRdLmNzc1tpZHhdO1xyXG4gICAgICAgICAgICAvLyBjaGFuZ2Ugc2hvZ2kgcGllY2UgY29sb3JzIGFjY29yZGluZyB0byBib2FyZCBvcmllbnRhdGlvblxyXG4gICAgICAgICAgICBpZiAoY29sb3IgPT09IFwiYmxhY2tcIikgY3NzID0gY3NzLnJlcGxhY2UoJzAnLCAnMScpO1xyXG4gICAgICAgICAgICBjaGFuZ2VDU1MoJy9zdGF0aWMvJyArIGNzcyArICcuY3NzJyk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uTXNnQm9hcmQgPSAobXNnKSA9PiB7XHJcbiAgICAgICAgaWYgKG1zZy5nYW1lSWQgIT09IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0pIHJldHVybjtcclxuICAgICAgICAvLyBHYW1lIGFib3J0ZWQuXHJcbiAgICAgICAgaWYgKG1zZ1tcInN0YXR1c1wiXSA9PT0gMCkgcmV0dXJuO1xyXG5cclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcImdvdCBib2FyZCBtc2c6XCIsIG1zZyk7XHJcbiAgICAgICAgdGhpcy5wbHkgPSBtc2cucGx5XHJcbiAgICAgICAgdGhpcy5mdWxsZmVuID0gbXNnLmZlbjtcclxuICAgICAgICB0aGlzLmRlc3RzID0gbXNnLmRlc3RzO1xyXG4gICAgICAgIGNvbnN0IGNsb2NrcyA9IG1zZy5jbG9ja3M7XHJcblxyXG4gICAgICAgIGNvbnN0IHBhcnRzID0gbXNnLmZlbi5zcGxpdChcIiBcIik7XHJcbiAgICAgICAgdGhpcy50dXJuQ29sb3IgPSBwYXJ0c1sxXSA9PT0gXCJ3XCIgPyBcIndoaXRlXCIgOiBcImJsYWNrXCI7XHJcblxyXG4gICAgICAgIGlmIChtc2cuc3RlcHMubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICB0aGlzLnN0ZXBzID0gW107XHJcbiAgICAgICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbW92ZWxpc3QnKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgcGF0Y2goY29udGFpbmVyLCBoKCdkaXYjbW92ZWxpc3QnKSk7XHJcblxyXG4gICAgICAgICAgICBtc2cuc3RlcHMuZm9yRWFjaCgoc3RlcCkgPT4geyBcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RlcHMucHVzaChzdGVwKTtcclxuICAgICAgICAgICAgICAgIHVwZGF0ZU1vdmVsaXN0KHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKG1zZy5wbHkgPT09IHRoaXMuc3RlcHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdGVwID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICdmZW4nOiBtc2cuZmVuLFxyXG4gICAgICAgICAgICAgICAgICAgICdtb3ZlJzogbXNnLmxhc3RNb3ZlWzBdICsgbXNnLmxhc3RNb3ZlWzFdLFxyXG4gICAgICAgICAgICAgICAgICAgICdjaGVjayc6IG1zZy5jaGVjayxcclxuICAgICAgICAgICAgICAgICAgICAndHVybkNvbG9yJzogdGhpcy50dXJuQ29sb3IsXHJcbiAgICAgICAgICAgICAgICAgICAgJ3Nhbic6IG1zZy5zdGVwc1swXS5zYW4sXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RlcHMucHVzaChzdGVwKTtcclxuICAgICAgICAgICAgICAgIHVwZGF0ZU1vdmVsaXN0KHRoaXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmFib3J0YWJsZSA9IE51bWJlcihwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSkgPD0gMTtcclxuICAgICAgICBpZiAoIXRoaXMuc3BlY3RhdG9yICYmICF0aGlzLmFib3J0YWJsZSAmJiB0aGlzLnJlc3VsdCA9PT0gXCJcIikge1xyXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Fib3J0JykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgnYnV0dG9uI2Fib3J0JywgeyBwcm9wczoge2Rpc2FibGVkOiB0cnVlfSB9KSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgbGFzdE1vdmUgPSBtc2cubGFzdE1vdmU7XHJcbiAgICAgICAgaWYgKGxhc3RNb3ZlICE9PSBudWxsICYmIHRoaXMudmFyaWFudCA9PT0gXCJzaG9naVwiKSB7XHJcbiAgICAgICAgICAgIGxhc3RNb3ZlID0gdXNpMnVjaShsYXN0TW92ZVswXSArIGxhc3RNb3ZlWzFdKTtcclxuICAgICAgICAgICAgbGFzdE1vdmUgPSBbbGFzdE1vdmUuc2xpY2UoMCwyKSwgbGFzdE1vdmUuc2xpY2UoMiw0KV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGRyb3AgbGFzdE1vdmUgY2F1c2luZyBzY3JvbGxiYXIgZmxpY2tlcixcclxuICAgICAgICAvLyBzbyB3ZSByZW1vdmUgZnJvbSBwYXJ0IHRvIGF2b2lkIHRoYXRcclxuICAgICAgICBpZiAobGFzdE1vdmUgIT09IG51bGwgJiYgbGFzdE1vdmVbMF1bMV0gPT09ICdAJykgbGFzdE1vdmUgPSBbbGFzdE1vdmVbMV1dO1xyXG4gICAgICAgIC8vIHNhdmUgY2FwdHVyZSBzdGF0ZSBiZWZvcmUgdXBkYXRpbmcgY2hlc3Nncm91bmRcclxuICAgICAgICBjb25zdCBjYXB0dXJlID0gbGFzdE1vdmUgIT09IG51bGwgJiYgdGhpcy5jaGVzc2dyb3VuZC5zdGF0ZS5waWVjZXNbbGFzdE1vdmVbMV1dXHJcblxyXG4gICAgICAgIGlmIChsYXN0TW92ZSAhPT0gbnVsbCAmJiAodGhpcy50dXJuQ29sb3IgPT09IHRoaXMubXljb2xvciB8fCB0aGlzLnNwZWN0YXRvcikpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMudmFyaWFudCA9PT0gXCJzaG9naVwiKSB7XHJcbiAgICAgICAgICAgICAgICBzb3VuZC5zaG9naW1vdmUoKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGlmIChjYXB0dXJlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc291bmQuY2FwdHVyZSgpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBzb3VuZC5tb3ZlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBsYXN0TW92ZSA9IFtdO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmNoZWNrU3RhdHVzKG1zZyk7XHJcbiAgICAgICAgaWYgKG1zZy5jaGVjaykge1xyXG4gICAgICAgICAgICBzb3VuZC5jaGVjaygpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3Qgb3BwY2xvY2sgPSAhdGhpcy5mbGlwID8gMCA6IDE7XHJcbiAgICAgICAgY29uc3QgbXljbG9jayA9IDEgLSBvcHBjbG9jaztcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc3BlY3RhdG9yKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2hlc3Nncm91bmQuc2V0KHtcclxuICAgICAgICAgICAgICAgIGZlbjogcGFydHNbMF0sXHJcbiAgICAgICAgICAgICAgICB0dXJuQ29sb3I6IHRoaXMudHVybkNvbG9yLFxyXG4gICAgICAgICAgICAgICAgY2hlY2s6IG1zZy5jaGVjayxcclxuICAgICAgICAgICAgICAgIGxhc3RNb3ZlOiBsYXN0TW92ZSxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHVwZGF0ZVBvY2tldHModGhpcywgdGhpcy52cG9ja2V0MCwgdGhpcy52cG9ja2V0MSk7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvY2tzWzBdLnBhdXNlKGZhbHNlKTtcclxuICAgICAgICAgICAgdGhpcy5jbG9ja3NbMV0ucGF1c2UoZmFsc2UpO1xyXG4gICAgICAgICAgICB0aGlzLmNsb2Nrc1tvcHBjbG9ja10uc2V0VGltZShjbG9ja3NbdGhpcy5vcHBjb2xvcl0pO1xyXG4gICAgICAgICAgICB0aGlzLmNsb2Nrc1tteWNsb2NrXS5zZXRUaW1lKGNsb2Nrc1t0aGlzLm15Y29sb3JdKTtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmFib3J0YWJsZSAmJiBtc2cuc3RhdHVzIDwgMCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudHVybkNvbG9yID09PSB0aGlzLm15Y29sb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsb2Nrc1tteWNsb2NrXS5zdGFydCgpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsb2Nrc1tvcHBjbG9ja10uc3RhcnQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnR1cm5Db2xvciA9PT0gdGhpcy5teWNvbG9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNoZXNzZ3JvdW5kLnNldCh7XHJcbiAgICAgICAgICAgICAgICAgICAgZmVuOiBwYXJ0c1swXSxcclxuICAgICAgICAgICAgICAgICAgICB0dXJuQ29sb3I6IHRoaXMudHVybkNvbG9yLFxyXG4gICAgICAgICAgICAgICAgICAgIG1vdmFibGU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZnJlZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yOiB0aGlzLm15Y29sb3IsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc3RzOiBtc2cuZGVzdHMsXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBjaGVjazogbXNnLmNoZWNrLFxyXG4gICAgICAgICAgICAgICAgICAgIGxhc3RNb3ZlOiBsYXN0TW92ZSxcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgdXBkYXRlUG9ja2V0cyh0aGlzLCB0aGlzLnZwb2NrZXQwLCB0aGlzLnZwb2NrZXQxKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2xvY2tzW29wcGNsb2NrXS5wYXVzZShmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNsb2Nrc1tvcHBjbG9ja10uc2V0VGltZShjbG9ja3NbdGhpcy5vcHBjb2xvcl0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9ja3NbbXljbG9ja10uc2V0VGltZShjbG9ja3NbdGhpcy5teWNvbG9yXSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuYWJvcnRhYmxlICYmIG1zZy5zdGF0dXMgPCAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9ja3NbbXljbG9ja10uc3RhcnQoY2xvY2tzW3RoaXMubXljb2xvcl0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdNWSBDTE9DSyBTVEFSVEVEJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInRyeWluZyB0byBwbGF5IHByZW1vdmUuLi4uXCIpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucHJlbW92ZSkgdGhpcy5wZXJmb3JtUHJlbW92ZSgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucHJlZHJvcCkgdGhpcy5wZXJmb3JtUHJlZHJvcCgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVzc2dyb3VuZC5zZXQoe1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGdpdmluZyBmZW4gaGVyZSB3aWxsIHBsYWNlIGNhc3RsaW5nIHJvb2tzIHRvIHRoZWlyIGRlc3RpbmF0aW9uIGluIGNoZXNzOTYwIHZhcmlhbnRzXHJcbiAgICAgICAgICAgICAgICAgICAgZmVuOiBwYXJ0c1swXSxcclxuICAgICAgICAgICAgICAgICAgICB0dXJuQ29sb3I6IHRoaXMudHVybkNvbG9yLFxyXG4gICAgICAgICAgICAgICAgICAgIHByZW1vdmFibGU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzdHM6IG1zZy5kZXN0cyxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGNoZWNrOiBtc2cuY2hlY2ssXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2xvY2tzW215Y2xvY2tdLnBhdXNlKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2xvY2tzW215Y2xvY2tdLnNldFRpbWUoY2xvY2tzW3RoaXMubXljb2xvcl0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jbG9ja3Nbb3BwY2xvY2tdLnNldFRpbWUoY2xvY2tzW3RoaXMub3BwY29sb3JdKTtcclxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5hYm9ydGFibGUgJiYgbXNnLnN0YXR1cyA8IDApIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsb2Nrc1tvcHBjbG9ja10uc3RhcnQoY2xvY2tzW3RoaXMub3BwY29sb3JdKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnT1BQIENMT0NLICBTVEFSVEVEJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vcHBJc1JhbmRvbU1vdmVyICYmIG1zZy5ybSAgIT09IFwiXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRvU2VuZCh7IHR5cGU6IFwibW92ZVwiLCBnYW1lSWQ6IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0sIG1vdmU6IG1zZy5ybSwgY2xvY2tzOiBjbG9ja3MgfSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgZ29QbHkgPSAocGx5KSA9PiB7XHJcbiAgICAgICAgY29uc3Qgc3RlcCA9IHRoaXMuc3RlcHNbcGx5XTtcclxuICAgICAgICB2YXIgbW92ZSA9IHN0ZXAubW92ZVxyXG4gICAgICAgIGlmIChtb3ZlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMudmFyaWFudCA9PT0gXCJzaG9naVwiKSBtb3ZlID0gdXNpMnVjaShtb3ZlKTtcclxuICAgICAgICAgICAgbW92ZSA9IG1vdmUuc2xpY2UoMSwgMikgPT09ICdAJyA/IFttb3ZlLnNsaWNlKDIsIDQpXSA6IFttb3ZlLnNsaWNlKDAsIDIpLCBtb3ZlLnNsaWNlKDIsIDQpXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY2hlc3Nncm91bmQuc2V0KHtcclxuICAgICAgICAgICAgZmVuOiBzdGVwLmZlbixcclxuICAgICAgICAgICAgdHVybkNvbG9yOiBzdGVwLnR1cm5Db2xvcixcclxuICAgICAgICAgICAgbW92YWJsZToge1xyXG4gICAgICAgICAgICAgICAgZnJlZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBjb2xvcjogdGhpcy5zcGVjdGF0b3IgPyB1bmRlZmluZWQgOiBzdGVwLnR1cm5Db2xvcixcclxuICAgICAgICAgICAgICAgIGRlc3RzOiB0aGlzLnJlc3VsdCA9PT0gXCJcIiAmJiBwbHkgPT09IHRoaXMuc3RlcHMubGVuZ3RoIC0gMSA/IHRoaXMuZGVzdHMgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjaGVjazogc3RlcC5jaGVjayxcclxuICAgICAgICAgICAgbGFzdE1vdmU6IG1vdmUsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5mdWxsZmVuID0gc3RlcC5mZW47XHJcbiAgICAgICAgdXBkYXRlUG9ja2V0cyh0aGlzLCB0aGlzLnZwb2NrZXQwLCB0aGlzLnZwb2NrZXQxKTtcclxuICAgICAgICAvLyBUT0RPOiBwbGF5IHNvdW5kIGlmIHBseSA9PSB0aGlzLnBseSArIDFcclxuICAgICAgICB0aGlzLnBseSA9IHBseVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZG9TZW5kID0gKG1lc3NhZ2UpID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIi0tLT4gZG9TZW5kKCk6XCIsIG1lc3NhZ2UpO1xyXG4gICAgICAgIHRoaXMuc29jay5zZW5kKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHNlbmRNb3ZlID0gKG9yaWcsIGRlc3QsIHByb21vKSA9PiB7XHJcbiAgICAgICAgLy8gcGF1c2UoKSB3aWxsIGFkZCBpbmNyZW1lbnQhXHJcbiAgICAgICAgY29uc3Qgb3BwY2xvY2sgPSAhdGhpcy5mbGlwID8gMCA6IDFcclxuICAgICAgICBjb25zdCBteWNsb2NrID0gMSAtIG9wcGNsb2NrO1xyXG4gICAgICAgIGNvbnN0IG1vdmV0aW1lID0gKHRoaXMuY2xvY2tzW215Y2xvY2tdLnJ1bm5pbmcpID8gRGF0ZS5ub3coKSAtIHRoaXMuY2xvY2tzW215Y2xvY2tdLnN0YXJ0VGltZSA6IDA7XHJcbiAgICAgICAgdGhpcy5jbG9ja3NbbXljbG9ja10ucGF1c2UoKHRoaXMuYmFzZSA9PT0gMCAmJiB0aGlzLnBseSA8IDIpID8gZmFsc2UgOiB0cnVlKTtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNlbmRNb3ZlKG9yaWcsIGRlc3QsIHByb20pXCIsIG9yaWcsIGRlc3QsIHByb21vKTtcclxuICAgICAgICBjb25zdCB1Y2lfbW92ZSA9IG9yaWcgKyBkZXN0ICsgcHJvbW87XHJcbiAgICAgICAgY29uc3QgbW92ZSA9IHRoaXMudmFyaWFudCA9PT0gXCJzaG9naVwiID8gdWNpMnVzaSh1Y2lfbW92ZSkgOiB1Y2lfbW92ZTtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNlbmRNb3ZlKG1vdmUpXCIsIG1vdmUpO1xyXG4gICAgICAgIC8vIFRPRE86IGlmIHByZW1vdmVkLCBzZW5kIDAgdGltZVxyXG4gICAgICAgIGxldCBiY2xvY2ssIGNsb2NrcztcclxuICAgICAgICBpZiAoIXRoaXMuZmxpcCkge1xyXG4gICAgICAgICAgICBiY2xvY2sgPSB0aGlzLm15Y29sb3IgPT09IFwiYmxhY2tcIiA/IDEgOiAwO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGJjbG9jayA9IHRoaXMubXljb2xvciA9PT0gXCJibGFja1wiID8gMCA6IDE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHdjbG9jayA9IDEgLSBiY2xvY2tcclxuICAgICAgICBjbG9ja3MgPSB7bW92ZXRpbWU6IG1vdmV0aW1lLCBibGFjazogdGhpcy5jbG9ja3NbYmNsb2NrXS5kdXJhdGlvbiwgd2hpdGU6IHRoaXMuY2xvY2tzW3djbG9ja10uZHVyYXRpb259O1xyXG4gICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJtb3ZlXCIsIGdhbWVJZDogdGhpcy5tb2RlbFtcImdhbWVJZFwiXSwgbW92ZTogbW92ZSwgY2xvY2tzOiBjbG9ja3MgfSk7XHJcbiAgICAgICAgaWYgKCF0aGlzLmFib3J0YWJsZSkgdGhpcy5jbG9ja3Nbb3BwY2xvY2tdLnN0YXJ0KCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1vdmUgPSAoKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIChvcmlnLCBkZXN0LCBjYXB0dXJlZFBpZWNlKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiICAgZ3JvdW5kLm9uTW92ZSgpXCIsIG9yaWcsIGRlc3QsIGNhcHR1cmVkUGllY2UpO1xyXG4gICAgICAgICAgICBpZiAodGhpcy52YXJpYW50ID09PSBcInNob2dpXCIpIHtcclxuICAgICAgICAgICAgICAgIHNvdW5kLnNob2dpbW92ZSgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhcHR1cmVkUGllY2UpIHtcclxuICAgICAgICAgICAgICAgICAgICBzb3VuZC5jYXB0dXJlKCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHNvdW5kLm1vdmUoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uRHJvcCA9ICgpID0+IHtcclxuICAgICAgICByZXR1cm4gKHBpZWNlLCBkZXN0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZ3JvdW5kLm9uRHJvcCgpXCIsIHBpZWNlLCBkZXN0KTtcclxuICAgICAgICAgICAgaWYgKGRlc3QgIT0gXCJhMFwiICYmIHBpZWNlLnJvbGUgJiYgZHJvcElzVmFsaWQodGhpcy5kZXN0cywgcGllY2Uucm9sZSwgZGVzdCkpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnZhcmlhbnQgPT09IFwic2hvZ2lcIikge1xyXG4gICAgICAgICAgICAgICAgICAgIHNvdW5kLnNob2dpbW92ZSgpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBzb3VuZC5tb3ZlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWNrRHJvcCA9IHBpZWNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgc2V0UHJlbW92ZSA9IChvcmlnLCBkZXN0LCBtZXRhKSA9PiB7XHJcbiAgICAgICAgdGhpcy5wcmVtb3ZlID0geyBvcmlnLCBkZXN0LCBtZXRhIH07XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJzZXRQcmVtb3ZlKCkgdG86XCIsIG9yaWcsIGRlc3QsIG1ldGEpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdW5zZXRQcmVtb3ZlID0gKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucHJlbW92ZSA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBzZXRQcmVkcm9wID0gKHJvbGUsIGtleSkgPT4ge1xyXG4gICAgICAgIHRoaXMucHJlZHJvcCA9IHsgcm9sZSwga2V5IH07XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJzZXRQcmVkcm9wKCkgdG86XCIsIHJvbGUsIGtleSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB1bnNldFByZWRyb3AgPSAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5wcmVkcm9wID0gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHBlcmZvcm1QcmVtb3ZlID0gKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHsgb3JpZywgZGVzdCwgbWV0YSB9ID0gdGhpcy5wcmVtb3ZlO1xyXG4gICAgICAgIC8vIFRPRE86IHByb21vdGlvbj9cclxuICAgICAgICBjb25zb2xlLmxvZyhcInBlcmZvcm1QcmVtb3ZlKClcIiwgb3JpZywgZGVzdCwgbWV0YSk7XHJcbiAgICAgICAgdGhpcy5jaGVzc2dyb3VuZC5wbGF5UHJlbW92ZSgpO1xyXG4gICAgICAgIHRoaXMucHJlbW92ZSA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBwZXJmb3JtUHJlZHJvcCA9ICgpID0+IHtcclxuICAgICAgICBjb25zdCB7IHJvbGUsIGtleSB9ID0gdGhpcy5wcmVkcm9wO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwicGVyZm9ybVByZWRyb3AoKVwiLCByb2xlLCBrZXkpO1xyXG4gICAgICAgIHRoaXMuY2hlc3Nncm91bmQucGxheVByZWRyb3AoZHJvcCA9PiB7IHJldHVybiBkcm9wSXNWYWxpZCh0aGlzLmRlc3RzLCBkcm9wLnJvbGUsIGRyb3Aua2V5KTsgfSk7XHJcbiAgICAgICAgdGhpcy5wcmVkcm9wID0gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uVXNlck1vdmUgPSAob3JpZywgZGVzdCwgbWV0YSkgPT4ge1xyXG4gICAgICAgIC8vIGNoZXNzZ3JvdW5kIGRvZXNuJ3Qga25vd3MgYWJvdXQgZXAsIHNvIHdlIGhhdmUgdG8gcmVtb3ZlIGVwIGNhcHR1cmVkIHBhd25cclxuICAgICAgICBjb25zdCBwaWVjZXMgPSB0aGlzLmNoZXNzZ3JvdW5kLnN0YXRlLnBpZWNlcztcclxuICAgICAgICBjb25zdCBnZW9tID0gdGhpcy5jaGVzc2dyb3VuZC5zdGF0ZS5nZW9tZXRyeTtcclxuICAgICAgICBjb25zb2xlLmxvZyhcImdyb3VuZC5vblVzZXJNb3ZlKClcIiwgb3JpZywgZGVzdCwgbWV0YSwgcGllY2VzKTtcclxuICAgICAgICBjb25zdCBtb3ZlZCA9IHBpZWNlc1tkZXN0XSBhcyBQaWVjZTtcclxuICAgICAgICBjb25zdCBmaXJzdFJhbmtJczAgPSB0aGlzLmNoZXNzZ3JvdW5kLnN0YXRlLmRpbWVuc2lvbnMuaGVpZ2h0ID09PSAxMDtcclxuICAgICAgICBpZiAobWV0YS5jYXB0dXJlZCA9PT0gdW5kZWZpbmVkICYmIG1vdmVkLnJvbGUgPT09IFwicGF3blwiICYmIG9yaWdbMF0gIT0gZGVzdFswXSAmJiBoYXNFcCh0aGlzLnZhcmlhbnQpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBvcyA9IGtleTJwb3MoZGVzdCwgZmlyc3RSYW5rSXMwKSxcclxuICAgICAgICAgICAgcGF3blBvczogUG9zID0gW3Bvc1swXSwgcG9zWzFdICsgKHRoaXMubXljb2xvciA9PT0gJ3doaXRlJyA/IC0xIDogMSldO1xyXG4gICAgICAgICAgICBjb25zdCBkaWZmOiBQaWVjZXNEaWZmID0ge307XHJcbiAgICAgICAgICAgIGRpZmZbcG9zMmtleShwYXduUG9zLCBnZW9tKV0gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIHRoaXMuY2hlc3Nncm91bmQuc2V0UGllY2VzKGRpZmYpO1xyXG4gICAgICAgICAgICBtZXRhLmNhcHR1cmVkID0ge3JvbGU6IFwicGF3blwifTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIC8vIGluY3JlYXNlIHBvY2tldCBjb3VudFxyXG4gICAgICAgIGlmICgodGhpcy52YXJpYW50ID09PSBcImNyYXp5aG91c2VcIiB8fCB0aGlzLnZhcmlhbnQgPT09IFwiY2FwYWhvdXNlXCIgfHwgdGhpcy52YXJpYW50ID09PSBcInNob3VzZVwiIHx8IHRoaXMudmFyaWFudCA9PT0gXCJzaG9naVwiKSAmJiBtZXRhLmNhcHR1cmVkKSB7XHJcbiAgICAgICAgICAgIHZhciByb2xlID0gbWV0YS5jYXB0dXJlZC5yb2xlXHJcbiAgICAgICAgICAgIGlmIChtZXRhLmNhcHR1cmVkLnByb21vdGVkKSByb2xlID0gdGhpcy52YXJpYW50ID09PSBcInNob2dpXCIgPyBtZXRhLmNhcHR1cmVkLnJvbGUuc2xpY2UoMSkgYXMgUm9sZSA6IFwicGF3blwiO1xyXG5cclxuICAgICAgICAgICAgaWYgKHRoaXMuZmxpcCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wb2NrZXRzWzBdW3JvbGVdKys7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZwb2NrZXQwID0gcGF0Y2godGhpcy52cG9ja2V0MCwgcG9ja2V0Vmlldyh0aGlzLCB0aGlzLm15Y29sb3IsIFwidG9wXCIpKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucG9ja2V0c1sxXVtyb2xlXSsrO1xyXG4gICAgICAgICAgICAgICAgdGhpcy52cG9ja2V0MSA9IHBhdGNoKHRoaXMudnBvY2tldDEsIHBvY2tldFZpZXcodGhpcywgdGhpcy5teWNvbG9yLCBcImJvdHRvbVwiKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvLyAgZ2F0aW5nIGVsZXBoYW50L2hhd2tcclxuICAgICAgICBpZiAodGhpcy52YXJpYW50ID09PSBcInNlaXJhd2FuXCIgfHwgdGhpcy52YXJpYW50ID09PSBcInNob3VzZVwiKSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5wcm9tb3Rpb24uc3RhcnQob3JpZywgZGVzdCwgbWV0YSkgJiYgIXRoaXMuZ2F0aW5nLnN0YXJ0KHRoaXMuZnVsbGZlbiwgb3JpZywgZGVzdCwgbWV0YSkpIHRoaXMuc2VuZE1vdmUob3JpZywgZGVzdCwgJycpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5wcm9tb3Rpb24uc3RhcnQob3JpZywgZGVzdCwgbWV0YSkpIHRoaXMuc2VuZE1vdmUob3JpZywgZGVzdCwgJycpO1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvblVzZXJEcm9wID0gKHJvbGUsIGRlc3QpID0+IHtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcImdyb3VuZC5vblVzZXJEcm9wKClcIiwgcm9sZSwgZGVzdCk7XHJcbiAgICAgICAgLy8gZGVjcmVhc2UgcG9ja2V0IGNvdW50XHJcbiAgICAgICAgaWYgKGRyb3BJc1ZhbGlkKHRoaXMuZGVzdHMsIHJvbGUsIGRlc3QpKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmZsaXApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucG9ja2V0c1swXVtyb2xlXS0tO1xyXG4gICAgICAgICAgICAgICAgdGhpcy52cG9ja2V0MCA9IHBhdGNoKHRoaXMudnBvY2tldDAsIHBvY2tldFZpZXcodGhpcywgdGhpcy5teWNvbG9yLCBcInRvcFwiKSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBvY2tldHNbMV1bcm9sZV0tLTtcclxuICAgICAgICAgICAgICAgIHRoaXMudnBvY2tldDEgPSBwYXRjaCh0aGlzLnZwb2NrZXQxLCBwb2NrZXRWaWV3KHRoaXMsIHRoaXMubXljb2xvciwgXCJib3R0b21cIikpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuc2VuZE1vdmUocm9sZVRvU2FuW3JvbGVdICsgXCJAXCIsIGRlc3QsICcnKVxyXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInNlbnQgbW92ZVwiLCBtb3ZlKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIiEhISBpbnZhbGlkIG1vdmUgISEhXCIsIHJvbGUsIGRlc3QpO1xyXG4gICAgICAgICAgICAvLyByZXN0b3JlIGJvYXJkXHJcbiAgICAgICAgICAgIHRoaXMuY2xpY2tEcm9wID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICB0aGlzLmNoZXNzZ3JvdW5kLnNldCh7XHJcbiAgICAgICAgICAgICAgICBmZW46IHRoaXMuZnVsbGZlbixcclxuICAgICAgICAgICAgICAgIGxhc3RNb3ZlOiB0aGlzLmxhc3Rtb3ZlLFxyXG4gICAgICAgICAgICAgICAgdHVybkNvbG9yOiB0aGlzLm15Y29sb3IsXHJcbiAgICAgICAgICAgICAgICBtb3ZhYmxlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVzdHM6IHRoaXMuZGVzdHMsXHJcbiAgICAgICAgICAgICAgICAgICAgc2hvd0Rlc3RzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIHVzZSB0aGlzIGZvciBzaXR0dXlpbiBpbiBwbGFjZSBwcm9tb3Rpb24gP1xyXG4gICAgLy8gT3IgaW1wbGVtZW50IG9uZGJsY2xpY2sgaGFuZGxlciB0byBlbWl0IG1vdmUgaW4gY2hlc3Nncm91bmQ/XHJcbiAgICAvLyBodHRwczovL3d3dy53M3NjaG9vbHMuY29tL2pzcmVmL2V2ZW50X29uZGJsY2xpY2suYXNwXHJcbiAgICBwcml2YXRlIG9uQ2hhbmdlID0gKHNlbGVjdGVkKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCIgICBncm91bmQub25DaGFuZ2UoKVwiLCBzZWxlY3RlZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIHVzZSB0aGlzIGZvciBzaXR0dXlpbiBpbiBwbGFjZSBwcm9tb3Rpb24gP1xyXG4gICAgcHJpdmF0ZSBvblNlbGVjdCA9IChzZWxlY3RlZCkgPT4ge1xyXG4gICAgICAgIHJldHVybiAoa2V5KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiICAgZ3JvdW5kLm9uU2VsZWN0KClcIiwga2V5LCBzZWxlY3RlZCwgdGhpcy5jbGlja0Ryb3AsIHRoaXMuY2hlc3Nncm91bmQuc3RhdGUpO1xyXG4gICAgICAgICAgICAvLyBJZiBkcm9wIHNlbGVjdGlvbiB3YXMgc2V0IGRyb3BEZXN0cyB3ZSBoYXZlIHRvIHJlc3RvcmUgZGVzdHMgaGVyZVxyXG4gICAgICAgICAgICBpZiAodGhpcy5jaGVzc2dyb3VuZC5zdGF0ZS5tb3ZhYmxlLmRlc3RzID09PSB1bmRlZmluZWQpIHJldHVybjtcclxuICAgICAgICAgICAgaWYgKGtleSAhPSBcImEwXCIgJiYgXCJhMFwiIGluIHRoaXMuY2hlc3Nncm91bmQuc3RhdGUubW92YWJsZS5kZXN0cykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY2xpY2tEcm9wICE9PSB1bmRlZmluZWQgJiYgZHJvcElzVmFsaWQodGhpcy5kZXN0cywgdGhpcy5jbGlja0Ryb3Aucm9sZSwga2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2hlc3Nncm91bmQubmV3UGllY2UodGhpcy5jbGlja0Ryb3AsIGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vblVzZXJEcm9wKHRoaXMuY2xpY2tEcm9wLnJvbGUsIGtleSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWNrRHJvcCA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2hlc3Nncm91bmQuc2V0KHsgbW92YWJsZTogeyBkZXN0czogdGhpcy5kZXN0cyB9fSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dVc2VyQ29ubmVjdGVkID0gKG1zZykgPT4ge1xyXG4gICAgICAgIHRoaXMubW9kZWxbXCJ1c2VybmFtZVwiXSA9IG1zZ1tcInVzZXJuYW1lXCJdO1xyXG4gICAgICAgIHJlbmRlclVzZXJuYW1lKHRoaXMubW9kZWxbXCJob21lXCJdLCB0aGlzLm1vZGVsW1widXNlcm5hbWVcIl0pO1xyXG4gICAgICAgIGlmICh0aGlzLnNwZWN0YXRvcikge1xyXG4gICAgICAgICAgICB0aGlzLmRvU2VuZCh7IHR5cGU6IFwiaXNfdXNlcl9vbmxpbmVcIiwgdXNlcm5hbWU6IHRoaXMud3BsYXllciB9KTtcclxuICAgICAgICAgICAgdGhpcy5kb1NlbmQoeyB0eXBlOiBcImlzX3VzZXJfb25saW5lXCIsIHVzZXJuYW1lOiB0aGlzLmJwbGF5ZXIgfSk7XHJcblxyXG4gICAgICAgICAgICAvLyB3ZSB3YW50IHRvIGtub3cgbGFzdE1vdmUgYW5kIGNoZWNrIHN0YXR1c1xyXG4gICAgICAgICAgICB0aGlzLmRvU2VuZCh7IHR5cGU6IFwiYm9hcmRcIiwgZ2FtZUlkOiB0aGlzLm1vZGVsW1wiZ2FtZUlkXCJdIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG9wcF9uYW1lID0gdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdID09PSB0aGlzLndwbGF5ZXIgPyB0aGlzLmJwbGF5ZXIgOiB0aGlzLndwbGF5ZXI7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJpc191c2VyX29ubGluZVwiLCB1c2VybmFtZTogb3BwX25hbWUgfSk7XHJcblxyXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JvdHRvbS1wbGF5ZXInKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgcGF0Y2goY29udGFpbmVyLCBoKCdpLXNpZGUub25saW5lI2JvdHRvbS1wbGF5ZXInLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLW9ubGluZVwiOiB0cnVlLCBcImljb24tb2ZmbGluZVwiOiBmYWxzZX19KSk7XHJcblxyXG4gICAgICAgICAgICAvLyBwcmV2ZW50IHNlbmRpbmcgZ2FtZVN0YXJ0IG1lc3NhZ2Ugd2hlbiB1c2VyIGp1c3QgcmVjb25lY3RpbmdcclxuICAgICAgICAgICAgaWYgKG1zZy5wbHkgPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJyZWFkeVwiLCBnYW1lSWQ6IHRoaXMubW9kZWxbXCJnYW1lSWRcIl0gfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5kb1NlbmQoeyB0eXBlOiBcImJvYXJkXCIsIGdhbWVJZDogdGhpcy5tb2RlbFtcImdhbWVJZFwiXSB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ1VzZXJPbmxpbmUgPSAobXNnKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2cobXNnKTtcclxuICAgICAgICBpZiAobXNnLnVzZXJuYW1lID09PSB0aGlzLnBsYXllcnNbMF0pIHtcclxuICAgICAgICAgICAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b3AtcGxheWVyJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgnaS1zaWRlLm9ubGluZSN0b3AtcGxheWVyJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1vbmxpbmVcIjogdHJ1ZSwgXCJpY29uLW9mZmxpbmVcIjogZmFsc2V9fSkpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYm90dG9tLXBsYXllcicpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2ktc2lkZS5vbmxpbmUjYm90dG9tLXBsYXllcicsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tb25saW5lXCI6IHRydWUsIFwiaWNvbi1vZmZsaW5lXCI6IGZhbHNlfX0pKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ1VzZXJEaXNjb25uZWN0ZWQgPSAobXNnKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2cobXNnKTtcclxuICAgICAgICBpZiAobXNnLnVzZXJuYW1lID09PSB0aGlzLnBsYXllcnNbMF0pIHtcclxuICAgICAgICAgICAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b3AtcGxheWVyJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgnaS1zaWRlLm9ubGluZSN0b3AtcGxheWVyJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi1vbmxpbmVcIjogZmFsc2UsIFwiaWNvbi1vZmZsaW5lXCI6IHRydWV9fSkpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYm90dG9tLXBsYXllcicpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2ktc2lkZS5vbmxpbmUjYm90dG9tLXBsYXllcicsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tb25saW5lXCI6IGZhbHNlLCBcImljb24tb2ZmbGluZVwiOiB0cnVlfX0pKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ0NoYXQgPSAobXNnKSA9PiB7XHJcbiAgICAgICAgaWYgKG1zZy51c2VyICE9PSB0aGlzLm1vZGVsW1widXNlcm5hbWVcIl0pIGNoYXRNZXNzYWdlKG1zZy51c2VyLCBtc2cubWVzc2FnZSwgXCJyb3VuZGNoYXRcIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ01vcmVUaW1lID0gKCkgPT4ge1xyXG4gICAgICAgIGNoYXRNZXNzYWdlKCcnLCB0aGlzLm15Y29sb3IgKyAnICsxNSBzZWNvbmRzJywgXCJyb3VuZGNoYXRcIik7XHJcbiAgICAgICAgdGhpcy5jbG9ja3NbMV0uc2V0VGltZSh0aGlzLmNsb2Nrc1sxXS5kdXJhdGlvbiArIDE1ICogMTAwMCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ09mZmVyID0gKG1zZykgPT4ge1xyXG4gICAgICAgIGNoYXRNZXNzYWdlKFwiXCIsIG1zZy5tZXNzYWdlLCBcInJvdW5kY2hhdFwiKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBvbk1lc3NhZ2UgPSAoZXZ0KSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCI8KysrIG9uTWVzc2FnZSgpOlwiLCBldnQuZGF0YSk7XHJcbiAgICAgICAgdmFyIG1zZyA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpO1xyXG4gICAgICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBcImJvYXJkXCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnQm9hcmQobXNnKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwiZ2FtZUVuZFwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVja1N0YXR1cyhtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJnYW1lU3RhcnRcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMub25Nc2dHYW1lU3RhcnQobXNnKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwiZ2FtZV91c2VyX2Nvbm5lY3RlZFwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ1VzZXJDb25uZWN0ZWQobXNnKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwidXNlcl9vbmxpbmVcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMub25Nc2dVc2VyT25saW5lKG1zZyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcInVzZXJfZGlzY29ubmVjdGVkXCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnVXNlckRpc2Nvbm5lY3RlZChtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJyb3VuZGNoYXRcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMub25Nc2dDaGF0KG1zZyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcIm5ld19nYW1lXCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnTmV3R2FtZShtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJvZmZlclwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ09mZmVyKG1zZyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcIm1vcmV0aW1lXCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnTW9yZVRpbWUoKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwidXBkYXRlVFZcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMub25Nc2dVcGRhdGVUVihtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuIiwiaW1wb3J0IHsgaCwgaW5pdCB9IGZyb20gXCJzbmFiYmRvbVwiO1xyXG5pbXBvcnQga2xhc3MgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9jbGFzcyc7XHJcbmltcG9ydCBhdHRyaWJ1dGVzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvYXR0cmlidXRlcyc7XHJcbmltcG9ydCBsaXN0ZW5lcnMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9ldmVudGxpc3RlbmVycyc7XHJcbmltcG9ydCB0b1ZOb2RlIGZyb20gJ3NuYWJiZG9tL3Rvdm5vZGUnO1xyXG5cclxuaW1wb3J0IHsga2V5MnBvcyB9IGZyb20gJ2NoZXNzZ3JvdW5keC91dGlsJztcclxuXHJcbmltcG9ydCB7IGNhbkdhdGUsIHJvbGVUb1NhbiB9IGZyb20gJy4vY2hlc3MnO1xyXG5pbXBvcnQgeyBwb2NrZXRWaWV3IH0gZnJvbSAnLi9wb2NrZXQnO1xyXG5cclxuY29uc3QgcGF0Y2ggPSBpbml0KFtrbGFzcywgYXR0cmlidXRlcywgbGlzdGVuZXJzXSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihjdHJsKSB7XHJcblxyXG4gICAgbGV0IGdhdGluZzogYW55ID0gZmFsc2U7XHJcbiAgICBsZXQgcm9sZXM7XHJcblxyXG4gICAgZnVuY3Rpb24gc3RhcnQoZmVuLCBvcmlnLCBkZXN0LCBtZXRhKSB7XHJcbiAgICAgICAgY29uc3QgZ3JvdW5kID0gY3RybC5nZXRHcm91bmQoKTtcclxuICAgICAgICBjb25zdCBnYXRhYmxlID0gY2FuR2F0ZShmZW4sIGdyb3VuZC5zdGF0ZS5waWVjZXNbZGVzdF0sIG9yaWcsIGRlc3QsIG1ldGEpXHJcbiAgICAgICAgcm9sZXMgPSBbXCJoYXdrXCIsIFwiZWxlcGhhbnRcIiwgXCJxdWVlblwiLCBcInJvb2tcIiwgXCJiaXNob3BcIiwgXCJrbmlnaHRcIiwgXCJcIl07XHJcblxyXG4gICAgICAgIGlmIChnYXRhYmxlWzBdIHx8IGdhdGFibGVbMV0gfHwgZ2F0YWJsZVsyXSB8fCBnYXRhYmxlWzNdIHx8IGdhdGFibGVbNF0gfHwgZ2F0YWJsZVs1XSkge1xyXG4gICAgICAgICAgICBjb25zdCBjb2xvciA9IGN0cmwubXljb2xvcjtcclxuICAgICAgICAgICAgY29uc3Qgb3JpZW50YXRpb24gPSBncm91bmQuc3RhdGUub3JpZW50YXRpb247XHJcbiAgICAgICAgICAgIGlmIChyb2xlcy5pbmRleE9mKFwiaGF3a1wiKSAhPT0gLTEgJiYgIWdhdGFibGVbMF0pIHJvbGVzLnNwbGljZShyb2xlcy5pbmRleE9mKFwiaGF3a1wiKSwgMSk7XHJcbiAgICAgICAgICAgIGlmIChyb2xlcy5pbmRleE9mKFwiZWxlcGhhbnRcIikgIT09IC0xICYmICFnYXRhYmxlWzFdKSByb2xlcy5zcGxpY2Uocm9sZXMuaW5kZXhPZihcImVsZXBoYW50XCIpLCAxKTtcclxuICAgICAgICAgICAgaWYgKHJvbGVzLmluZGV4T2YoXCJxdWVlblwiKSAhPT0gLTEgJiYgIWdhdGFibGVbMl0pIHJvbGVzLnNwbGljZShyb2xlcy5pbmRleE9mKFwicXVlZW5cIiksIDEpO1xyXG4gICAgICAgICAgICBpZiAocm9sZXMuaW5kZXhPZihcInJvb2tcIikgIT09IC0xICYmICFnYXRhYmxlWzNdKSByb2xlcy5zcGxpY2Uocm9sZXMuaW5kZXhPZihcInJvb2tcIiksIDEpO1xyXG4gICAgICAgICAgICBpZiAocm9sZXMuaW5kZXhPZihcImJpc2hvcFwiKSAhPT0gLTEgJiYgIWdhdGFibGVbNF0pIHJvbGVzLnNwbGljZShyb2xlcy5pbmRleE9mKFwiYmlzaG9wXCIpLCAxKTtcclxuICAgICAgICAgICAgaWYgKHJvbGVzLmluZGV4T2YoXCJrbmlnaHRcIikgIT09IC0xICYmICFnYXRhYmxlWzVdKSByb2xlcy5zcGxpY2Uocm9sZXMuaW5kZXhPZihcImtuaWdodFwiKSwgMSk7XHJcblxyXG4gICAgICAgICAgICB2YXIgb3JpZ3MgPSBbb3JpZ107XHJcbiAgICAgICAgICAgIGNvbnN0IGNhc3RsaW5nID0gZ3JvdW5kLnN0YXRlLnBpZWNlc1tkZXN0XS5yb2xlID09PSBcImtpbmdcIiAmJiBvcmlnWzBdID09PSBcImVcIiAmJiBkZXN0WzBdICE9PSBcImRcIiAmJiBkZXN0WzBdICE9PSBcImVcIiAmJiBkZXN0WzBdICE9PSBcImZcIjtcclxuICAgICAgICAgICAgdmFyIHJvb2tEZXN0ID0gXCJcIjtcclxuICAgICAgICAgICAgaWYgKGNhc3RsaW5nKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBPLU9cclxuICAgICAgICAgICAgICAgIGlmIChkZXN0WzBdID4gXCJlXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICBvcmlncy5wdXNoKFwiaFwiICsgb3JpZ1sxXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcm9va0Rlc3QgPSAgXCJlXCIgKyBvcmlnWzFdO1xyXG4gICAgICAgICAgICAgICAgLy8gTy1PLU9cclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3JpZ3MucHVzaChcImFcIiArIG9yaWdbMV0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHJvb2tEZXN0ID0gIFwiZVwiICsgb3JpZ1sxXTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGRyYXdfZ2F0aW5nKG9yaWdzLCBjb2xvciwgb3JpZW50YXRpb24pO1xyXG4gICAgICAgICAgICBnYXRpbmcgPSB7XHJcbiAgICAgICAgICAgICAgICBvcmlnczogb3JpZ3MsXHJcbiAgICAgICAgICAgICAgICBkZXN0OiBkZXN0LFxyXG4gICAgICAgICAgICAgICAgcm9va0Rlc3Q6IHJvb2tEZXN0LFxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2s6IGN0cmwuc2VuZE1vdmUsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9O1xyXG5cclxuICAgIGZ1bmN0aW9uIGdhdGUoY3RybCwgb3JpZywgZGVzdCwgcm9sZSkge1xyXG4gICAgICAgIGNvbnN0IGcgPSBjdHJsLmdldEdyb3VuZCgpO1xyXG4gICAgICAgIGNvbnN0IGNvbG9yID0gZy5zdGF0ZS5waWVjZXNbZGVzdF0uY29sb3I7XHJcbiAgICAgICAgZy5uZXdQaWVjZSh7XCJyb2xlXCI6IHJvbGUsIFwiY29sb3JcIjogY29sb3J9LCBvcmlnKVxyXG4gICAgICAgIGN0cmwucG9ja2V0c1tjb2xvciA9PT0gJ3doaXRlJyA/IDAgOiAxXVtyb2xlXS0tO1xyXG4gICAgICAgIGN0cmwudnBvY2tldDEgPSBwYXRjaChjdHJsLnZwb2NrZXQxLCBwb2NrZXRWaWV3KGN0cmwsIGNvbG9yLCBcImJvdHRvbVwiKSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZHJhd19nYXRpbmcob3JpZ3MsIGNvbG9yLCBvcmllbnRhdGlvbikge1xyXG4gICAgICAgIHZhciBjb250YWluZXIgPSB0b1ZOb2RlKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2V4dGVuc2lvbicpIGFzIE5vZGUpO1xyXG4gICAgICAgIHBhdGNoKGNvbnRhaW5lciwgcmVuZGVyR2F0aW5nKG9yaWdzLCBjb2xvciwgb3JpZW50YXRpb24pKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBkcmF3X25vX2dhdGluZygpIHtcclxuICAgICAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2V4dGVuc2lvbl9jaG9pY2UnKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ2V4dGVuc2lvbicpKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBmaW5pc2gocm9sZSwgaW5kZXgpIHtcclxuICAgICAgICBpZiAoZ2F0aW5nKSB7XHJcbiAgICAgICAgICAgIGRyYXdfbm9fZ2F0aW5nKCk7XHJcbiAgICAgICAgICAgIGlmIChyb2xlKSBnYXRlKGN0cmwsIGdhdGluZy5vcmlnc1tpbmRleF0sIGdhdGluZy5kZXN0LCByb2xlKTtcclxuICAgICAgICAgICAgZWxzZSBpbmRleCA9IDA7XHJcbiAgICAgICAgICAgIGNvbnN0IGdhdGVkID0gcm9sZSA/IHJvbGVUb1Nhbltyb2xlXS50b0xvd2VyQ2FzZSgpIDogXCJcIjtcclxuICAgICAgICAgICAgaWYgKGdhdGluZy5jYWxsYmFjaykgZ2F0aW5nLmNhbGxiYWNrKGdhdGluZy5vcmlnc1tpbmRleF0sIGluZGV4ID09PSAwID8gZ2F0aW5nLmRlc3QgOiBnYXRpbmcucm9va0Rlc3QsIGdhdGVkKTtcclxuICAgICAgICAgICAgZ2F0aW5nID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBmdW5jdGlvbiBjYW5jZWwoKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJDQU5DRUwgZ2F0aW5nXCIpO1xyXG4gICAgICAgIHJldHVyblxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGJpbmQoZXZlbnROYW1lOiBzdHJpbmcsIGY6IChlOiBFdmVudCkgPT4gdm9pZCwgcmVkcmF3KSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgaW5zZXJ0KHZub2RlKSB7XHJcbiAgICAgICAgICAgICAgICB2bm9kZS5lbG0uYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGUgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGYoZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZHJhdykgcmVkcmF3KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcztcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZW5kZXJTcXVhcmVzKG9yaWcsIGNvbG9yLCBvcmllbnRhdGlvbiwgaW5kZXgpIHtcclxuICAgICAgICBjb25zdCBmaXJzdFJhbmtJczAgPSBmYWxzZTtcclxuICAgICAgICB2YXIgbGVmdCA9ICg4IC0ga2V5MnBvcyhvcmlnLCBmaXJzdFJhbmtJczApWzBdKSAqIDEyLjU7XHJcbiAgICAgICAgaWYgKG9yaWVudGF0aW9uID09PSBcIndoaXRlXCIpIGxlZnQgPSA4Ny41IC0gbGVmdDtcclxuICAgICAgICByZXR1cm4gcm9sZXMubWFwKChzZXJ2ZXJSb2xlLCBpKSA9PiB7XHJcbiAgICAgICAgICAgIHZhciB0b3AgPSAoY29sb3IgPT09IG9yaWVudGF0aW9uID8gNyAtIGkgOiBpKSAqIDEyLjU7XHJcbiAgICAgICAgICAgIHJldHVybiBoKFxyXG4gICAgICAgICAgICAgICAgXCJzcXVhcmVcIixcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBhdHRyczogeyBzdHlsZTogXCJ0b3A6IFwiICsgdG9wICsgXCIlO2xlZnQ6IFwiICsgbGVmdCArIFwiJVwiIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgaG9vazogYmluZChcImNsaWNrXCIsIGUgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaW5pc2goc2VydmVyUm9sZSwgaW5kZXgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sIGZhbHNlKVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIFtoKFwicGllY2UuXCIgKyBzZXJ2ZXJSb2xlICsgXCIuXCIgKyBjb2xvcildXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfSlcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZW5kZXJHYXRpbmcob3JpZ3MsIGNvbG9yLCBvcmllbnRhdGlvbikge1xyXG4gICAgICAgIHZhciB2ZXJ0aWNhbCA9IGNvbG9yID09PSBvcmllbnRhdGlvbiA/IFwidG9wXCIgOiBcImJvdHRvbVwiO1xyXG4gICAgICAgIHZhciBzcXVhcmVzID0gcmVuZGVyU3F1YXJlcyhvcmlnc1swXSwgY29sb3IsIG9yaWVudGF0aW9uLCAwKTtcclxuICAgICAgICBpZiAob3JpZ3MubGVuZ3RoID4gMSkgc3F1YXJlcyA9IHNxdWFyZXMuY29uY2F0KHJlbmRlclNxdWFyZXMob3JpZ3NbMV0sIGNvbG9yLCBvcmllbnRhdGlvbiwgMSkpO1xyXG4gICAgICAgIHJldHVybiBoKFxyXG4gICAgICAgICAgICBcImRpdiNleHRlbnNpb25fY2hvaWNlLlwiICsgdmVydGljYWwsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGhvb2s6IHtcclxuICAgICAgICAgICAgICAgICAgICBpbnNlcnQ6IHZub2RlID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZWwgPSB2bm9kZS5lbG0gYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBjYW5jZWwoKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjb250ZXh0bWVudVwiLCBlID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzcXVhcmVzXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXJ0LFxyXG4gICAgfTtcclxufVxyXG4iLCJpbXBvcnQgU29ja2V0dGUgZnJvbSAnc29ja2V0dGUnO1xyXG5cclxuaW1wb3J0IHsgaW5pdCB9IGZyb20gJ3NuYWJiZG9tJztcclxuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xyXG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xyXG5pbXBvcnQgcHJvcGVydGllcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJztcclxuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcclxuXHJcbmNvbnN0IHBhdGNoID0gaW5pdChba2xhc3MsIGF0dHJpYnV0ZXMsIHByb3BlcnRpZXMsIGxpc3RlbmVyc10pO1xyXG5cclxuaW1wb3J0IGggZnJvbSAnc25hYmJkb20vaCc7XHJcbmltcG9ydCB7IFZOb2RlIH0gZnJvbSAnc25hYmJkb20vdm5vZGUnO1xyXG5cclxuaW1wb3J0IHsgcmVuZGVyVXNlcm5hbWUgfSBmcm9tICcuL3VzZXInO1xyXG5pbXBvcnQgeyBjaGF0TWVzc2FnZSwgY2hhdFZpZXcgfSBmcm9tICcuL2NoYXQnO1xyXG5pbXBvcnQgeyB2YXJpYW50cywgdmFyaWFudHM5NjAsIFZBUklBTlRTIH0gZnJvbSAnLi9jaGVzcyc7XHJcblxyXG5cclxuY2xhc3MgTG9iYnlDb250cm9sbGVyIHtcclxuICAgIG1vZGVsO1xyXG4gICAgc29jaztcclxuICAgIHBsYXllcjtcclxuICAgIGxvZ2dlZF9pbjtcclxuICAgIGNoYWxsZW5nZUFJO1xyXG4gICAgX3dzO1xyXG4gICAgc2Vla3M7XHJcblxyXG4gICAgY29uc3RydWN0b3IoZWwsIG1vZGVsKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJMb2JieUNvbnRyb2xsZXIgY29uc3RydWN0b3JcIiwgZWwsIG1vZGVsKTtcclxuXHJcbiAgICAgICAgdGhpcy5tb2RlbCA9IG1vZGVsO1xyXG4gICAgICAgIHRoaXMuY2hhbGxlbmdlQUkgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgY29uc3Qgb25PcGVuID0gKGV2dCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLl93cyA9IGV2dC50YXJnZXQ7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLS0tQ09OTkVDVEVEXCIsIGV2dCk7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJsb2JieV91c2VyX2Nvbm5lY3RlZFwiLCB1c2VybmFtZTogdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdfSk7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJnZXRfc2Vla3NcIiB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX3dzID0ge1wicmVhZHlTdGF0ZVwiOiAtMX07XHJcbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcclxuICAgICAgICAgICAgbWF4QXR0ZW1wdHM6IDIwLFxyXG4gICAgICAgICAgICBvbm9wZW46IGUgPT4gb25PcGVuKGUpLFxyXG4gICAgICAgICAgICBvbm1lc3NhZ2U6IGUgPT4gdGhpcy5vbk1lc3NhZ2UoZSksXHJcbiAgICAgICAgICAgIG9ucmVjb25uZWN0OiBlID0+IGNvbnNvbGUubG9nKCdSZWNvbm5lY3RpbmcgaW4gbG9iYnkuLi4nLCBlKSxcclxuICAgICAgICAgICAgb25tYXhpbXVtOiBlID0+IGNvbnNvbGUubG9nKCdTdG9wIEF0dGVtcHRpbmchJywgZSksXHJcbiAgICAgICAgICAgIG9uY2xvc2U6IGUgPT4ge2NvbnNvbGUubG9nKCdDbG9zZWQhJywgZSk7fSxcclxuICAgICAgICAgICAgb25lcnJvcjogZSA9PiBjb25zb2xlLmxvZygnRXJyb3I6JywgZSksXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdGhpcy5zb2NrID0gbmV3IFNvY2tldHRlKFwid3M6Ly9cIiArIGxvY2F0aW9uLmhvc3QgKyBcIi93c2xcIiwgb3B0cyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhdGNoKGVycikge1xyXG4gICAgICAgICAgICB0aGlzLnNvY2sgPSBuZXcgU29ja2V0dGUoXCJ3c3M6Ly9cIiArIGxvY2F0aW9uLmhvc3QgKyBcIi93c2xcIiwgb3B0cyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBnZXQgc2Vla3Mgd2hlbiB3ZSBhcmUgY29taW5nIGJhY2sgYWZ0ZXIgYSBnYW1lXHJcbiAgICAgICAgaWYgKHRoaXMuX3dzLnJlYWR5U3RhdGUgPT09IDEpIHtcclxuICAgICAgICAgICAgdGhpcy5kb1NlbmQoeyB0eXBlOiBcImdldF9zZWVrc1wiIH0pO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgcGF0Y2goZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZWtidXR0b25zJykgYXMgSFRNTEVsZW1lbnQsIGgoJ3VsI3NlZWtidXR0b25zJywgdGhpcy5yZW5kZXJTZWVrQnV0dG9ucygpKSk7XHJcbiAgICAgICAgcGF0Y2goZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvYmJ5Y2hhdCcpIGFzIEhUTUxFbGVtZW50LCBjaGF0Vmlldyh0aGlzLCBcImxvYmJ5Y2hhdFwiKSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGRvU2VuZCAobWVzc2FnZSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiLS0tPiBsb2JieSBkb1NlbmQoKTpcIiwgbWVzc2FnZSk7XHJcbiAgICAgICAgdGhpcy5zb2NrLnNlbmQoSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xyXG4gICAgfVxyXG5cclxuICAgIGNyZWF0ZVNlZWtNc2cgKHZhcmlhbnQsIGNvbG9yLCBmZW4sIG1pbnV0ZXMsIGluY3JlbWVudCwgY2hlc3M5NjApIHtcclxuICAgICAgICB0aGlzLmRvU2VuZCh7XHJcbiAgICAgICAgICAgIHR5cGU6IFwiY3JlYXRlX3NlZWtcIixcclxuICAgICAgICAgICAgdXNlcjogdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdLFxyXG4gICAgICAgICAgICB2YXJpYW50OiB2YXJpYW50LFxyXG4gICAgICAgICAgICBmZW46IGZlbixcclxuICAgICAgICAgICAgbWludXRlczogbWludXRlcyxcclxuICAgICAgICAgICAgaW5jcmVtZW50OiBpbmNyZW1lbnQsXHJcbiAgICAgICAgICAgIHJhdGVkOiBmYWxzZSxcclxuICAgICAgICAgICAgY2hlc3M5NjA6IGNoZXNzOTYwLFxyXG4gICAgICAgICAgICBjb2xvcjogY29sb3IgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY3JlYXRlQm90Q2hhbGxlbmdlTXNnICh2YXJpYW50LCBjb2xvciwgZmVuLCBtaW51dGVzLCBpbmNyZW1lbnQsIGxldmVsLCBjaGVzczk2MCkge1xyXG4gICAgICAgIHRoaXMuZG9TZW5kKHtcclxuICAgICAgICAgICAgdHlwZTogXCJjcmVhdGVfYWlfY2hhbGxlbmdlXCIsXHJcbiAgICAgICAgICAgIHVzZXI6IHRoaXMubW9kZWxbXCJ1c2VybmFtZVwiXSxcclxuICAgICAgICAgICAgdmFyaWFudDogdmFyaWFudCxcclxuICAgICAgICAgICAgZmVuOiBmZW4sXHJcbiAgICAgICAgICAgIG1pbnV0ZXM6IG1pbnV0ZXMsXHJcbiAgICAgICAgICAgIGluY3JlbWVudDogaW5jcmVtZW50LFxyXG4gICAgICAgICAgICByYXRlZDogZmFsc2UsXHJcbiAgICAgICAgICAgIGxldmVsOiBsZXZlbCxcclxuICAgICAgICAgICAgY2hlc3M5NjA6IGNoZXNzOTYwLFxyXG4gICAgICAgICAgICBjb2xvcjogY29sb3IgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaXNOZXdTZWVrICh2YXJpYW50LCBjb2xvciwgZmVuLCBtaW51dGVzLCBpbmNyZW1lbnQpIHtcclxuICAgICAgICByZXR1cm4gIXRoaXMuc2Vla3Muc29tZShzZWVrID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHNlZWsudXNlciA9PT0gdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdICYmIHNlZWsudmFyaWFudCA9PT0gdmFyaWFudCAmJiBzZWVrLmZlbiA9PT0gZmVuICYmIHNlZWsuY29sb3IgPT09IGNvbG9yICYmIHNlZWsudGMgPT09IG1pbnV0ZXMgKyBcIitcIiArIGluY3JlbWVudDtcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG5cclxuICAgIGNyZWF0ZVNlZWsgKGNvbG9yKSB7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lkMDEnKSEuc3R5bGUuZGlzcGxheT0nbm9uZSc7XHJcbiAgICAgICAgbGV0IGU7XHJcbiAgICAgICAgZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2YXJpYW50JykgYXMgSFRNTFNlbGVjdEVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgdmFyaWFudCA9IGUub3B0aW9uc1tlLnNlbGVjdGVkSW5kZXhdLnZhbHVlO1xyXG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic2Vla192YXJpYW50XCIsIHZhcmlhbnQpO1xyXG5cclxuICAgICAgICBlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZlbicpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgZmVuID0gZS52YWx1ZTtcclxuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcInNlZWtfZmVuXCIsIGUudmFsdWUpO1xyXG5cclxuICAgICAgICBlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21pbicpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgbWludXRlcyA9IHBhcnNlSW50KGUudmFsdWUpO1xyXG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic2Vla19taW5cIiwgZS52YWx1ZSk7XHJcblxyXG4gICAgICAgIGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5jJykgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICBjb25zdCBpbmNyZW1lbnQgPSBwYXJzZUludChlLnZhbHVlKTtcclxuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcInNlZWtfaW5jXCIsIGUudmFsdWUpO1xyXG5cclxuICAgICAgICBlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NoZXNzOTYwJykgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICBjb25zdCBoaWRlID0gdmFyaWFudHM5NjAuaW5kZXhPZih2YXJpYW50KSA9PT0gLTE7XHJcbiAgICAgICAgY29uc3QgY2hlc3M5NjAgPSAoaGlkZSkgPyBmYWxzZSA6IGUuY2hlY2tlZDtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIkNSRUFURSBTRUVLIHZhcmlhbnQsIGNvbG9yLCBmZW4sIG1pbnV0ZXMsIGluY3JlbWVudCwgaGlkZSwgY2hlc3M5NjBcIiwgdmFyaWFudCwgY29sb3IsIGZlbiwgbWludXRlcywgaW5jcmVtZW50LCBoaWRlLCBjaGVzczk2MCk7XHJcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJzZWVrX2NoZXNzOTYwXCIsIGUuY2hlY2tlZCk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNoYWxsZW5nZUFJKSB7XHJcbiAgICAgICAgICAgIGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdpbnB1dFtuYW1lPVwibGV2ZWxcIl06Y2hlY2tlZCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGxldmVsID0gcGFyc2VJbnQoZS52YWx1ZSk7XHJcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic2Vla19sZXZlbFwiLCBlLnZhbHVlKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2cobGV2ZWwsIGUudmFsdWUsIGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwic2Vla19sZXZlbFwiKSk7XHJcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlQm90Q2hhbGxlbmdlTXNnKHZhcmlhbnQsIGNvbG9yLCBmZW4sIG1pbnV0ZXMsIGluY3JlbWVudCwgbGV2ZWwsIGNoZXNzOTYwKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5pc05ld1NlZWsodmFyaWFudCwgY29sb3IsIGZlbiwgbWludXRlcywgaW5jcmVtZW50KSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVTZWVrTXNnKHZhcmlhbnQsIGNvbG9yLCBmZW4sIG1pbnV0ZXMsIGluY3JlbWVudCwgY2hlc3M5NjApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJlbmRlclNlZWtCdXR0b25zICgpIHtcclxuICAgICAgICBjb25zdCBzZXRWYXJpYW50ID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBsZXQgZTtcclxuICAgICAgICAgICAgZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2YXJpYW50JykgYXMgSFRNTFNlbGVjdEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IHZhcmlhbnQgPSBlLm9wdGlvbnNbZS5zZWxlY3RlZEluZGV4XS52YWx1ZTtcclxuICAgICAgICAgICAgY29uc3QgaGlkZSA9IHZhcmlhbnRzOTYwLmluZGV4T2YodmFyaWFudCkgPT09IC0xO1xyXG5cclxuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NoZXNzOTYwLWJsb2NrJykhLnN0eWxlLmRpc3BsYXkgPSAoaGlkZSkgPyAnbm9uZScgOiAnYmxvY2snO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3Qgc2V0TWludXRlcyA9IChtaW51dGVzKSA9PiB7XHJcbiAgICAgICAgICAgIHZhciBtaW4sIGluYyA9IDA7XHJcbiAgICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibWludXRlc1wiKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgaWYgKGVsKSBlbC5pbm5lckhUTUwgPSBtaW51dGVzO1xyXG5cclxuICAgICAgICAgICAgdmFyIGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWluJykgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgaWYgKGUpIG1pbiA9IHBhcnNlSW50KGUudmFsdWUpO1xyXG5cclxuICAgICAgICAgICAgZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbmMnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoZSkgaW5jID0gcGFyc2VJbnQoZS52YWx1ZSk7XHJcblxyXG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29sb3ItYnV0dG9uLWdyb3VwJykhLnN0eWxlLmRpc3BsYXkgPSAobWluICsgaW5jID09PSAwKSA/ICdub25lJyA6ICdibG9jayc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBzZXRJbmNyZW1lbnQgPSAoaW5jcmVtZW50KSA9PiB7XHJcbiAgICAgICAgICAgIHZhciBtaW4sIGluYyA9IDA7XHJcbiAgICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaW5jcmVtZW50XCIpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoZWwpIGVsLmlubmVySFRNTCA9IGluY3JlbWVudDtcclxuXHJcbiAgICAgICAgICAgIHZhciBlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21pbicpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGlmIChlKSBtaW4gPSBwYXJzZUludChlLnZhbHVlKTtcclxuXHJcbiAgICAgICAgICAgIGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5jJykgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgaWYgKGUpIGluYyA9IHBhcnNlSW50KGUudmFsdWUpO1xyXG5cclxuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbG9yLWJ1dHRvbi1ncm91cCcpIS5zdHlsZS5kaXNwbGF5ID0gKG1pbiArIGluYyA9PT0gMCkgPyAnbm9uZScgOiAnYmxvY2snO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgdklkeCA9IGxvY2FsU3RvcmFnZS5zZWVrX3ZhcmlhbnQgPT09IHVuZGVmaW5lZCA/IDAgOiB2YXJpYW50cy5pbmRleE9mKGxvY2FsU3RvcmFnZS5zZWVrX3ZhcmlhbnQpO1xyXG4gICAgICAgIGNvbnN0IHZGZW4gPSBsb2NhbFN0b3JhZ2Uuc2Vla19mZW4gPT09IHVuZGVmaW5lZCA/IFwiXCIgOiBsb2NhbFN0b3JhZ2Uuc2Vla19mZW47XHJcbiAgICAgICAgY29uc3Qgdk1pbiA9IGxvY2FsU3RvcmFnZS5zZWVrX21pbiA9PT0gdW5kZWZpbmVkID8gXCI1XCIgOiBsb2NhbFN0b3JhZ2Uuc2Vla19taW47XHJcbiAgICAgICAgY29uc3QgdkluYyA9IGxvY2FsU3RvcmFnZS5zZWVrX2luYyA9PT0gdW5kZWZpbmVkID8gXCIzXCIgOiBsb2NhbFN0b3JhZ2Uuc2Vla19pbmM7XHJcbiAgICAgICAgY29uc3QgdkxldmVsID0gbG9jYWxTdG9yYWdlLnNlZWtfbGV2ZWwgPT09IHVuZGVmaW5lZCA/IFwiMVwiIDogbG9jYWxTdG9yYWdlLnNlZWtfbGV2ZWw7XHJcbiAgICAgICAgY29uc3QgdkNoZXNzOTYwID0gbG9jYWxTdG9yYWdlLnNlZWtfY2hlc3M5NjAgPT09IHVuZGVmaW5lZCA/IFwiZmFsc2VcIiA6IGxvY2FsU3RvcmFnZS5zZWVrX2NoZXNzOTYwO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwibG9jYWxlU3RvcmFnZS5zZWVrX2xldmVsLCB2TGV2ZWw9XCIsIGxvY2FsU3RvcmFnZS5zZWVrX2xldmVsLCB2TGV2ZWwpO1xyXG5cclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgIGgoJ2RpdiNpZDAxJywgeyBjbGFzczoge1wibW9kYWxcIjogdHJ1ZX0gfSwgW1xyXG4gICAgICAgICAgaCgnZm9ybS5tb2RhbC1jb250ZW50JywgW1xyXG4gICAgICAgICAgICBoKCdkaXYjY2xvc2Vjb250YWluZXInLCBbXHJcbiAgICAgICAgICAgICAgaCgnc3Bhbi5jbG9zZScsIHsgb246IHsgY2xpY2s6ICgpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpZDAxJykhLnN0eWxlLmRpc3BsYXk9J25vbmUnIH0sIGF0dHJzOiB7J2RhdGEtaWNvbic6ICdqJ30sIHByb3BzOiB7dGl0bGU6IFwiQ2FuY2VsXCJ9IH0pLFxyXG4gICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgaCgnZGl2LmNvbnRhaW5lcicsIFtcclxuICAgICAgICAgICAgICAgIGgoJ2xhYmVsJywgeyBhdHRyczoge2ZvcjogXCJ2YXJpYW50XCJ9IH0sIFwiVmFyaWFudFwiKSxcclxuICAgICAgICAgICAgICAgIGgoJ3NlbGVjdCN2YXJpYW50Jywge1xyXG4gICAgICAgICAgICAgICAgICAgIHByb3BzOiB7bmFtZTogXCJ2YXJpYW50XCJ9LFxyXG4gICAgICAgICAgICAgICAgICAgIG9uOiB7IGlucHV0OiAoKSA9PiBzZXRWYXJpYW50KCkgfSxcclxuICAgICAgICAgICAgICAgICAgICBob29rOiB7aW5zZXJ0OiAoKSA9PiBzZXRWYXJpYW50KCkgfSxcclxuICAgICAgICAgICAgICAgICAgICB9LCB2YXJpYW50cy5tYXAoKHZhcmlhbnQsIGlkeCkgPT4gaCgnb3B0aW9uJywgeyBwcm9wczoge3ZhbHVlOiB2YXJpYW50LCBzZWxlY3RlZDogKGlkeCA9PT0gdklkeCkgPyBcInNlbGVjdGVkXCIgOiBcIlwifSB9LCB2YXJpYW50KSkpLFxyXG4gICAgICAgICAgICAgICAgaCgnbGFiZWwnLCB7IGF0dHJzOiB7Zm9yOiBcImZlblwifSB9LCBcIlN0YXJ0IHBvc2l0aW9uXCIpLFxyXG4gICAgICAgICAgICAgICAgaCgnaW5wdXQjZmVuJywgeyBwcm9wczoge25hbWU6ICdmZW4nLCBwbGFjZWhvbGRlcjogJ1Bhc3RlIHRoZSBGRU4gdGV4dCBoZXJlJywgdmFsdWU6IHZGZW59IH0pLFxyXG4gICAgICAgICAgICAgICAgaCgnZGl2I2NoZXNzOTYwLWJsb2NrJywgW1xyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsJywgeyBhdHRyczoge2ZvcjogXCJjaGVzczk2MFwifSB9LCBcIkNoZXNzOTYwXCIpLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2lucHV0I2NoZXNzOTYwJywge3Byb3BzOiB7bmFtZTogXCJjaGVzczk2MFwiLCB0eXBlOiBcImNoZWNrYm94XCIsIGNoZWNrZWQ6IHZDaGVzczk2MCA9PT0gXCJ0cnVlXCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9fSksXHJcbiAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgIC8vaCgnbGFiZWwnLCB7IGF0dHJzOiB7Zm9yOiBcInRjXCJ9IH0sIFwiVGltZSBDb250cm9sXCIpLFxyXG4gICAgICAgICAgICAgICAgLy9oKCdzZWxlY3QjdGltZWNvbnRyb2wnLCB7IHByb3BzOiB7bmFtZTogXCJ0aW1lY29udHJvbFwifSB9LCBbXHJcbiAgICAgICAgICAgICAgICAvLyAgICBoKCdvcHRpb24nLCB7IHByb3BzOiB7dmFsdWU6IFwiMVwiLCBzZWxlY3RlZDogdHJ1ZX0gfSwgXCJSZWFsIHRpbWVcIiksXHJcbiAgICAgICAgICAgICAgICAvLyAgICBoKCdvcHRpb24nLCB7IHByb3BzOiB7dmFsdWU6IFwiMlwifSB9LCBcIlVubGltaXRlZFwiKSxcclxuICAgICAgICAgICAgICAgIC8vXSksXHJcbiAgICAgICAgICAgICAgICBoKCdsYWJlbCcsIHsgYXR0cnM6IHtmb3I6IFwibWluXCJ9IH0sIFwiTWludXRlcyBwZXIgc2lkZTpcIiksXHJcbiAgICAgICAgICAgICAgICBoKCdzcGFuI21pbnV0ZXMnKSxcclxuICAgICAgICAgICAgICAgIGgoJ2lucHV0I21pbicsIHsgY2xhc3M6IHsgXCJzbGlkZXJcIjogdHJ1ZSB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BzOiB7bmFtZTogXCJtaW5cIiwgdHlwZTogXCJyYW5nZVwiLCBtaW46IDAsIG1heDogNjAsIHZhbHVlOiB2TWlufSxcclxuICAgICAgICAgICAgICAgICAgICBvbjogeyBpbnB1dDogKGUpID0+IHNldE1pbnV0ZXMoKGUudGFyZ2V0IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKSB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGhvb2s6IHtpbnNlcnQ6ICh2bm9kZSkgPT4gc2V0TWludXRlcygodm5vZGUuZWxtIGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKSB9LFxyXG4gICAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICAgICBoKCdsYWJlbCcsIHsgYXR0cnM6IHtmb3I6IFwiaW5jXCJ9IH0sIFwiSW5jcmVtZW50IGluIHNlY29uZHM6XCIpLFxyXG4gICAgICAgICAgICAgICAgaCgnc3BhbiNpbmNyZW1lbnQnKSxcclxuICAgICAgICAgICAgICAgIGgoJ2lucHV0I2luYycsIHsgY2xhc3M6IHtcInNsaWRlclwiOiB0cnVlIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcHM6IHtuYW1lOiBcImluY1wiLCB0eXBlOiBcInJhbmdlXCIsIG1pbjogMCwgbWF4OiAxNSwgdmFsdWU6IHZJbmN9LFxyXG4gICAgICAgICAgICAgICAgICAgIG9uOiB7IGlucHV0OiAoZSkgPT4gc2V0SW5jcmVtZW50KChlLnRhcmdldCBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZSkgfSxcclxuICAgICAgICAgICAgICAgICAgICBob29rOiB7aW5zZXJ0OiAodm5vZGUpID0+IHNldEluY3JlbWVudCgodm5vZGUuZWxtIGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKSB9LFxyXG4gICAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICAgICAvLyBpZiBwbGF5IHdpdGggdGhlIG1hY2hpbmVcclxuICAgICAgICAgICAgICAgIC8vIEEuSS5MZXZlbCAoMS04IGJ1dHRvbnMpXHJcbiAgICAgICAgICAgICAgICBoKCdmb3JtI2FpbGV2ZWwnLCBbXHJcbiAgICAgICAgICAgICAgICBoKCdoNCcsIFwiQS5JLiBMZXZlbFwiKSxcclxuICAgICAgICAgICAgICAgIGgoJ2Rpdi5yYWRpby1ncm91cCcsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTEnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCIxXCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCIxXCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpMScsIHsgYXR0cnM6IHtmb3I6IFwiYWkxXCJ9IH0sIFwiMVwiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTInLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCIyXCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCIyXCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpMicsIHsgYXR0cnM6IHtmb3I6IFwiYWkyXCJ9IH0sIFwiMlwiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTMnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCIzXCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCIzXCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpMycsIHsgYXR0cnM6IHtmb3I6IFwiYWkzXCJ9IH0sIFwiM1wiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTQnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCI0XCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCI0XCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpNCcsIHsgYXR0cnM6IHtmb3I6IFwiYWk0XCJ9IH0sIFwiNFwiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTUnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCI1XCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCI1XCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpNScsIHsgYXR0cnM6IHtmb3I6IFwiYWk1XCJ9IH0sIFwiNVwiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTYnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCI2XCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCI2XCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpNicsIHsgYXR0cnM6IHtmb3I6IFwiYWk2XCJ9IH0sIFwiNlwiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTcnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCI3XCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCI3XCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpNycsIHsgYXR0cnM6IHtmb3I6IFwiYWk3XCJ9IH0sIFwiN1wiKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdpbnB1dCNhaTgnLCB7IHByb3BzOiB7IHR5cGU6IFwicmFkaW9cIiwgbmFtZTogXCJsZXZlbFwiLCB2YWx1ZTogXCI4XCIsIGNoZWNrZWQ6IHZMZXZlbCA9PT0gXCI4XCIgPyBcImNoZWNrZWRcIiA6IFwiXCJ9IH0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2xhYmVsLmxldmVsLWFpLmFpOCcsIHsgYXR0cnM6IHtmb3I6IFwiYWk4XCJ9IH0sIFwiOFwiKSxcclxuICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICBoKCdkaXYjY29sb3ItYnV0dG9uLWdyb3VwJywgW1xyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2J1dHRvbi5pY29uLmljb24tYmxhY2snLCB7IHByb3BzOiB7dHlwZTogXCJidXR0b25cIiwgdGl0bGU6IFwiQmxhY2tcIn0sIG9uOiB7Y2xpY2s6ICgpID0+IHRoaXMuY3JlYXRlU2VlaygnYicpIH0gfSksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnYnV0dG9uLmljb24uaWNvbi1hZGp1c3QnLCB7IHByb3BzOiB7dHlwZTogXCJidXR0b25cIiwgdGl0bGU6IFwiUmFuZG9tXCJ9LCBvbjoge2NsaWNrOiAoKSA9PiB0aGlzLmNyZWF0ZVNlZWsoJ3InKX0gfSksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnYnV0dG9uLmljb24uaWNvbi13aGl0ZScsIHsgcHJvcHM6IHt0eXBlOiBcImJ1dHRvblwiLCB0aXRsZTogXCJXaGl0ZVwifSwgb246IHtjbGljazogKCkgPT4gdGhpcy5jcmVhdGVTZWVrKCd3Jyl9IH0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgXSksXHJcbiAgICAgICAgXSksXHJcbiAgICAgICAgaCgnYnV0dG9uJywgeyBjbGFzczogeydsb2JieS1idXR0b24nOiB0cnVlfSwgb246IHtcclxuICAgICAgICAgICAgY2xpY2s6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2hhbGxlbmdlQUkgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhaWxldmVsJykhLnN0eWxlLmRpc3BsYXk9J25vbmUnO1xyXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lkMDEnKSEuc3R5bGUuZGlzcGxheT0nYmxvY2snO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IH0sIFwiQ3JlYXRlIGEgZ2FtZVwiKSxcclxuICAgICAgICBoKCdidXR0b24nLCB7IGNsYXNzOiB7J2xvYmJ5LWJ1dHRvbic6IHRydWV9LCBvbjoge1xyXG4gICAgICAgICAgICBjbGljazogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGFsbGVuZ2VBSSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWlsZXZlbCcpIS5zdHlsZS5kaXNwbGF5PSdpbmxpbmUtYmxvY2snO1xyXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lkMDEnKSEuc3R5bGUuZGlzcGxheT0nYmxvY2snO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IH0sIFwiUGxheSB3aXRoIHRoZSBtYWNoaW5lXCIpLFxyXG4gICAgICAgIF07XHJcbiAgICB9XHJcblxyXG4gICAgb25DbGlja1NlZWsoc2Vlaykge1xyXG4gICAgICAgIGlmIChzZWVrW1widXNlclwiXSA9PT0gdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJkZWxldGVfc2Vla1wiLCBzZWVrSUQ6IHNlZWtbXCJzZWVrSURcIl0sIHBsYXllcjogdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZG9TZW5kKHsgdHlwZTogXCJhY2NlcHRfc2Vla1wiLCBzZWVrSUQ6IHNlZWtbXCJzZWVrSURcIl0sIHBsYXllcjogdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZW5kZXJTZWVrcyhzZWVrcykge1xyXG4gICAgICAgIC8vIFRPRE86IGZpeCBoZWFkZXIgYW5kIGRhdGEgcm93IGNvbG9tbnNcclxuICAgICAgICAvLyBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zNzI3MjMzMS9odG1sLXRhYmxlLXdpdGgtZml4ZWQtaGVhZGVyLWFuZC1mb290ZXItYW5kLXNjcm9sbGFibGUtYm9keS13aXRob3V0LWZpeGVkLXdpZHRoc1xyXG4gICAgICAgIGNvbnN0IGhlYWRlciA9IGgoJ3RoZWFkJywgW2goJ3RyJyxcclxuICAgICAgICAgICAgW2goJ3RoJywgJ1BsYXllcicpLFxyXG4gICAgICAgICAgICAgaCgndGgnLCAnQ29sb3InKSxcclxuICAgICAgICAgICAgIGgoJ3RoJywgJ1JhdGluZycpLFxyXG4gICAgICAgICAgICAgaCgndGgnLCAnVGltZScpLFxyXG4gICAgICAgICAgICAgaCgndGgnLCAnICAgICcpLFxyXG4gICAgICAgICAgICAgaCgndGgnLCAnVmFyaWFudCcpLFxyXG4gICAgICAgICAgICAgaCgndGgnLCAnTW9kZScpXSldKTtcclxuICAgICAgICBjb25zdCBjb2xvckljb24gPSAoY29sb3IpID0+IHsgcmV0dXJuIGgoJ2knLCB7YXR0cnM6IHtcImRhdGEtaWNvblwiOiBjb2xvciA9PT0gXCJ3XCIgPyBcImNcIiA6IGNvbG9yID09PSBcImJcIiA/IFwiYlwiIDogXCJhXCJ9fSApOyB9O1xyXG4gICAgICAgIHZhciByb3dzID0gc2Vla3MubWFwKChzZWVrKSA9PiBoKFxyXG4gICAgICAgICAgICAndHInLFxyXG4gICAgICAgICAgICB7IG9uOiB7IGNsaWNrOiAoKSA9PiB0aGlzLm9uQ2xpY2tTZWVrKHNlZWspIH0gfSxcclxuICAgICAgICAgICAgW2goJ3RkJywgc2Vla1tcInVzZXJcIl0pLFxyXG4gICAgICAgICAgICAgaCgndGQnLCBbY29sb3JJY29uKHNlZWtbXCJjb2xvclwiXSldKSxcclxuICAgICAgICAgICAgIGgoJ3RkJywgJzE1MDA/JyksXHJcbiAgICAgICAgICAgICBoKCd0ZCcsIHNlZWtbXCJ0Y1wiXSksXHJcbiAgICAgICAgICAgICBoKCd0ZCcsIHthdHRyczoge1wiZGF0YS1pY29uXCI6IFZBUklBTlRTW3NlZWtbXCJ2YXJpYW50XCJdXS5pY29ufSwgY2xhc3M6IHtcImljb25cIjogdHJ1ZX19ICksXHJcbiAgICAgICAgICAgICBoKCd0ZCcsIHthdHRyczoge1wiZGF0YS1pY29uXCI6IChzZWVrLmNoZXNzOTYwKSA/IFwiVlwiIDogXCJcIn0sIGNsYXNzOiB7XCJpY29uXCI6IHRydWV9fSApLFxyXG4gICAgICAgICAgICAgaCgndGQnLCBzZWVrW1widmFyaWFudFwiXSksXHJcbiAgICAgICAgICAgICBoKCd0ZCcsIHNlZWtbXCJyYXRlZFwiXSkgXSlcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICByZXR1cm4gW2hlYWRlciwgaCgndGJvZHknLCByb3dzKV07XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ0dldFNlZWtzID0gKG1zZykgPT4ge1xyXG4gICAgICAgIHRoaXMuc2Vla3MgPSBtc2cuc2Vla3M7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCIhISEhIGdvdCBnZXRfc2Vla3MgbXNnOlwiLCBtc2cpO1xyXG4gICAgICAgIGNvbnN0IG9sZFZOb2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlZWtzJyk7XHJcbiAgICAgICAgaWYgKG9sZFZOb2RlIGluc3RhbmNlb2YgRWxlbWVudCkge1xyXG4gICAgICAgICAgICBvbGRWTm9kZS5pbm5lckhUTUwgPSAnJztcclxuICAgICAgICAgICAgcGF0Y2gob2xkVk5vZGUgYXMgSFRNTEVsZW1lbnQsIGgoJ3RhYmxlI3NlZWtzJywgdGhpcy5yZW5kZXJTZWVrcyhtc2cuc2Vla3MpKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb25Nc2dOZXdHYW1lID0gKG1zZykgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiTG9iYnlDb250cm9sbGVyLm9uTXNnTmV3R2FtZSgpXCIsIHRoaXMubW9kZWxbXCJnYW1lSWRcIl0pXHJcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLmFzc2lnbih0aGlzLm1vZGVsW1wiaG9tZVwiXSArICcvJyArIG1zZ1tcImdhbWVJZFwiXSk7XHJcbn1cclxuXHJcbiAgICBwcml2YXRlIG9uTXNnVXNlckNvbm5lY3RlZCA9IChtc2cpID0+IHtcclxuICAgICAgICB0aGlzLm1vZGVsW1widXNlcm5hbWVcIl0gPSBtc2dbXCJ1c2VybmFtZVwiXTtcclxuICAgICAgICByZW5kZXJVc2VybmFtZSh0aGlzLm1vZGVsW1wiaG9tZVwiXSwgdGhpcy5tb2RlbFtcInVzZXJuYW1lXCJdKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uTXNnQ2hhdCA9IChtc2cpID0+IHtcclxuICAgICAgICBpZiAobXNnLnVzZXIgIT09IHRoaXMubW9kZWxbXCJ1c2VybmFtZVwiXSkgY2hhdE1lc3NhZ2UobXNnLnVzZXIsIG1zZy5tZXNzYWdlLCBcImxvYmJ5Y2hhdFwiKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uTXNnRnVsbENoYXQgPSAobXNnKSA9PiB7XHJcbiAgICAgICAgbXNnLmxpbmVzLmZvckVhY2goKGxpbmUpID0+IHtjaGF0TWVzc2FnZShsaW5lLnVzZXIsIGxpbmUubWVzc2FnZSwgXCJsb2JieWNoYXRcIik7fSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbk1zZ1BpbmcgPSAobXNnKSA9PiB7XHJcbiAgICAgICAgdGhpcy5kb1NlbmQoe3R5cGU6IFwicG9uZ1wiLCB0aW1lc3RhbXA6IG1zZy50aW1lc3RhbXB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uTXNnU2h1dGRvd24gPSAobXNnKSA9PiB7XHJcbiAgICAgICAgYWxlcnQobXNnLm1lc3NhZ2UpO1xyXG4gICAgfVxyXG5cclxuICAgIG9uTWVzc2FnZSAoZXZ0KSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCI8KysrIGxvYmJ5IG9uTWVzc2FnZSgpOlwiLCBldnQuZGF0YSk7XHJcbiAgICAgICAgdmFyIG1zZyA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpO1xyXG4gICAgICAgIHN3aXRjaCAobXNnLnR5cGUpIHtcclxuICAgICAgICAgICAgY2FzZSBcImdldF9zZWVrc1wiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ0dldFNlZWtzKG1zZyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcIm5ld19nYW1lXCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnTmV3R2FtZShtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJsb2JieV91c2VyX2Nvbm5lY3RlZFwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ1VzZXJDb25uZWN0ZWQobXNnKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFwibG9iYnljaGF0XCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnQ2hhdChtc2cpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgXCJmdWxsY2hhdFwiOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5vbk1zZ0Z1bGxDaGF0KG1zZyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcInBpbmdcIjpcclxuICAgICAgICAgICAgICAgIHRoaXMub25Nc2dQaW5nKG1zZyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBcInNodXRkb3duXCI6XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uTXNnU2h1dGRvd24obXNnKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcnVuU2Vla3Modm5vZGU6IFZOb2RlLCBtb2RlbCkge1xyXG4gICAgY29uc3QgZWwgPSB2bm9kZS5lbG0gYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICBjb25zdCBjdHJsID0gbmV3IExvYmJ5Q29udHJvbGxlcihlbCwgbW9kZWwpO1xyXG4gICAgY29uc29sZS5sb2coXCJsb2JieVZpZXcoKSAtPiBydW5TZWVrcygpXCIsIGVsLCBtb2RlbCwgY3RybCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBsb2JieVZpZXcobW9kZWwpOiBWTm9kZVtdIHtcclxuICAgIC8vIEdldCB0aGUgbW9kYWxcclxuICAgIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lkMDEnKSE7XHJcblxyXG4gICAgLy8gV2hlbiB0aGUgdXNlciBjbGlja3MgYW55d2hlcmUgb3V0c2lkZSBvZiB0aGUgbW9kYWwsIGNsb3NlIGl0XHJcbiAgICB3aW5kb3cub25jbGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICAgICAgaWYgKGV2ZW50LnRhcmdldCA9PSBtb2RhbCkge1xyXG4gICAgICAgICAgICBtb2RhbC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBbaCgnYXNpZGUuc2lkZWJhci1maXJzdCcsIFsgaCgnZGl2LmxvYmJ5Y2hhdCNsb2JieWNoYXQnKSBdKSxcclxuICAgICAgICAgICAgaCgnbWFpbi5tYWluJywgWyBoKCd0YWJsZSNzZWVrcycsIHtob29rOiB7IGluc2VydDogKHZub2RlKSA9PiBydW5TZWVrcyh2bm9kZSwgbW9kZWwpIH0gfSkgXSksXHJcbiAgICAgICAgICAgIGgoJ2FzaWRlLnNpZGViYXItc2Vjb25kJywgWyBoKCd1bCNzZWVrYnV0dG9ucycpIF0pLFxyXG4gICAgICAgICAgICBoKCd1bmRlci1sZWZ0JywgXCIjIG9mIHVzZXJzXCIpLFxyXG4gICAgICAgICAgICBoKCd1bmRlci1sb2JieScpLFxyXG4gICAgICAgICAgICBoKCd1bmRlci1yaWdodCcpLFxyXG4gICAgICAgIF07XHJcbn1cclxuIiwiaW1wb3J0IHsgaW5pdCB9IGZyb20gJ3NuYWJiZG9tJztcclxuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xyXG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xyXG5pbXBvcnQgcHJvcGVydGllcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJztcclxuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcclxuaW1wb3J0IGggZnJvbSAnc25hYmJkb20vaCc7XHJcbmltcG9ydCB7IFZOb2RlIH0gZnJvbSAnc25hYmJkb20vdm5vZGUnO1xyXG5cclxuY29uc3QgcGF0Y2ggPSBpbml0KFtrbGFzcywgYXR0cmlidXRlcywgcHJvcGVydGllcywgbGlzdGVuZXJzXSk7XHJcblxyXG5pbXBvcnQgeyBsb2JieVZpZXcgfSBmcm9tICcuL2xvYmJ5JztcclxuaW1wb3J0IHsgcm91bmRWaWV3IH0gZnJvbSAnLi9yb3VuZCc7XHJcbmltcG9ydCB7IHBsYXllcnNWaWV3IH0gZnJvbSAnLi9wbGF5ZXJzJztcclxuaW1wb3J0IHsgcHJvZmlsZVZpZXcgfSBmcm9tICcuL3Byb2ZpbGUnO1xyXG5pbXBvcnQgeyBhYm91dFZpZXcgfSBmcm9tICcuL2Fib3V0JztcclxuXHJcbmNvbnN0IG1vZGVsID0ge2hvbWU6IFwiXCIsIHVzZXJuYW1lOiBcIlwiLCBhbm9uOiBcIlwiLCB2YXJpYW50OiBcIlwiLCBnYW1lSWQ6IDAsIHdwbGF5ZXI6IFwiXCIsIGJwbGF5ZXI6IFwiXCIsIGZlbjogXCJcIiwgYmFzZTogXCJcIiwgaW5jOiBcIlwiLCBzZWVrczogW10sIHR2OiBcIlwiLCBwcm9maWxlaWQ6IFwiXCIsIHN0YXR1czogXCJcIn07XHJcblxyXG52YXIgZ2V0Q29va2llID0gZnVuY3Rpb24obmFtZSkge1xyXG4gICAgdmFyIGNvb2tpZXMgPSBkb2N1bWVudC5jb29raWUuc3BsaXQoJzsnKTtcclxuICAgIGZvcih2YXIgaT0wIDsgaSA8IGNvb2tpZXMubGVuZ3RoIDsgKytpKSB7XHJcbiAgICAgICAgdmFyIHBhaXIgPSBjb29raWVzW2ldLnRyaW0oKS5zcGxpdCgnPScpO1xyXG4gICAgICAgIGlmKHBhaXJbMF0gPT0gbmFtZSlcclxuICAgICAgICAgICAgcmV0dXJuIHBhaXJbMV07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gXCJcIjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHZpZXcoZWwsIG1vZGVsKTogVk5vZGUge1xyXG4gICAgY29uc3QgdXNlciA9IGdldENvb2tpZShcInVzZXJcIik7XHJcbiAgICBpZiAodXNlciAhPT0gXCJcIikgbW9kZWxbXCJ1c2VybmFtZVwiXSA9IHVzZXI7XHJcblxyXG4gICAgbW9kZWxbXCJob21lXCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1ob21lXCIpO1xyXG4gICAgbW9kZWxbXCJhbm9uXCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1hbm9uXCIpO1xyXG4gICAgbW9kZWxbXCJwcm9maWxlaWRcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXByb2ZpbGVcIik7XHJcbiAgICBtb2RlbFtcInZhcmlhbnRcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXZhcmlhbnRcIik7XHJcbiAgICBtb2RlbFtcImNoZXNzOTYwXCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1jaGVzczk2MFwiKTtcclxuICAgIG1vZGVsW1wibGV2ZWxcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLWxldmVsXCIpO1xyXG4gICAgbW9kZWxbXCJ1c2VybmFtZVwiXSA9IHVzZXIgIT09IFwiXCIgPyB1c2VyIDogZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS11c2VyXCIpO1xyXG4gICAgbW9kZWxbXCJnYW1lSWRcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLWdhbWVpZFwiKTtcclxuICAgIG1vZGVsW1wid3BsYXllclwiXSA9IGVsLmdldEF0dHJpYnV0ZShcImRhdGEtd3BsYXllclwiKTtcclxuICAgIG1vZGVsW1wid3RpdGxlXCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS13dGl0bGVcIik7XHJcbiAgICBtb2RlbFtcImJwbGF5ZXJcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLWJwbGF5ZXJcIik7XHJcbiAgICBtb2RlbFtcImJ0aXRsZVwiXSA9IGVsLmdldEF0dHJpYnV0ZShcImRhdGEtYnRpdGxlXCIpO1xyXG4gICAgbW9kZWxbXCJmZW5cIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLWZlblwiKTtcclxuICAgIG1vZGVsW1wiYmFzZVwiXSA9IGVsLmdldEF0dHJpYnV0ZShcImRhdGEtYmFzZVwiKTtcclxuICAgIG1vZGVsW1wiaW5jXCJdID0gZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1pbmNcIik7XHJcbiAgICBtb2RlbFtcInJlc3VsdFwiXSA9IGVsLmdldEF0dHJpYnV0ZShcImRhdGEtcmVzdWx0XCIpO1xyXG4gICAgbW9kZWxbXCJzdGF0dXNcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXN0YXR1c1wiKTtcclxuICAgIG1vZGVsW1wiZGF0ZVwiXSA9IGVsLmdldEF0dHJpYnV0ZShcImRhdGEtZGF0ZVwiKTtcclxuICAgIG1vZGVsW1widHZcIl0gPSBlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXZpZXdcIikgPT09ICd0dic7XHJcblxyXG4gICAgc3dpdGNoIChlbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXZpZXdcIikpIHtcclxuICAgIGNhc2UgJ2Fib3V0JzpcclxuICAgICAgICByZXR1cm4gaCgnZGl2I3BsYWNlaG9sZGVyLmFib3V0LXdyYXBwZXInLCBhYm91dFZpZXcobW9kZWwpKTtcclxuICAgIGNhc2UgJ3BsYXllcnMnOlxyXG4gICAgICAgIHJldHVybiBoKCdkaXYjcGxhY2Vob2xkZXIucGxheWVycy13cmFwcGVyJywgcGxheWVyc1ZpZXcobW9kZWwpKTtcclxuICAgIGNhc2UgJ3Byb2ZpbGUnOlxyXG4gICAgICAgIHJldHVybiBoKCdkaXYjcGxhY2Vob2xkZXIucHJvZmlsZS13cmFwcGVyJywgcHJvZmlsZVZpZXcobW9kZWwpKTtcclxuICAgIGNhc2UgJ3R2JzpcclxuICAgIGNhc2UgJ3JvdW5kJzpcclxuICAgICAgICByZXR1cm4gaCgnZGl2I3BsYWNlaG9sZGVyLm1haW4td3JhcHBlcicsIHJvdW5kVmlldyhtb2RlbCkpO1xyXG4gICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gaCgnZGl2I3BsYWNlaG9sZGVyLm1haW4td3JhcHBlcicsIGxvYmJ5Vmlldyhtb2RlbCkpO1xyXG4gICAgfVxyXG59XHJcblxyXG5jb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdweWNoZXNzLXZhcmlhbnRzJyk7XHJcbmlmIChlbCBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcclxuICAgIHBhdGNoKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGFjZWhvbGRlcicpIGFzIEhUTUxFbGVtZW50LCB2aWV3KGVsLCBtb2RlbCkpO1xyXG59XHJcbiIsImltcG9ydCB7IGluaXQgfSBmcm9tIFwic25hYmJkb21cIjtcbmltcG9ydCBrbGFzcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2NsYXNzJztcbmltcG9ydCBhdHRyaWJ1dGVzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvYXR0cmlidXRlcyc7XG5pbXBvcnQgcHJvcGVydGllcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJztcbmltcG9ydCBsaXN0ZW5lcnMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9ldmVudGxpc3RlbmVycyc7XG5cbmNvbnN0IHBhdGNoID0gaW5pdChba2xhc3MsIGF0dHJpYnV0ZXMsIHByb3BlcnRpZXMsIGxpc3RlbmVyc10pO1xuXG5pbXBvcnQgaCBmcm9tICdzbmFiYmRvbS9oJztcblxuaW1wb3J0IHsgcG9ja2V0VmlldyB9IGZyb20gJy4vcG9ja2V0JztcbmltcG9ydCB7IG5lZWRQb2NrZXRzIH0gZnJvbSAnLi9jaGVzcyc7XG5cblxuZnVuY3Rpb24gc2VsZWN0TW92ZSAoY3RybCwgcGx5KSB7XG4gICAgY29uc3QgYWN0aXZlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbGkubW92ZS5hY3RpdmUnKTtcbiAgICBpZiAoYWN0aXZlKSBhY3RpdmUuY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJyk7XG4gICAgY29uc3QgZWxQbHkgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBsaS5tb3ZlW3BseT1cIiR7cGx5fVwiXWApO1xuICAgIGlmIChlbFBseSkgZWxQbHkuY2xhc3NMaXN0LmFkZCgnYWN0aXZlJyk7XG4gICAgY3RybC5nb1BseShwbHkpXG4gICAgc2Nyb2xsVG9QbHkoY3RybCk7XG59XG5cbmZ1bmN0aW9uIHNjcm9sbFRvUGx5IChjdHJsKSB7XG4gICAgaWYgKGN0cmwuc3RlcHMubGVuZ3RoIDwgOSkgcmV0dXJuO1xuICAgIGNvbnN0IG1vdmVzRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbW92ZXMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICBsZXQgc3Q6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBjb25zdCBwbHlFbCA9IG1vdmVzRWwucXVlcnlTZWxlY3RvcignbGkubW92ZS5hY3RpdmUnKSBhcyBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgICBpZiAoY3RybC5wbHkgPT0gMCkgc3QgPSAwO1xuICAgIGVsc2UgaWYgKGN0cmwucGx5ID09IGN0cmwuc3RlcHMubGVuZ3RoIC0gMSkgc3QgPSA5OTk5OTtcbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKHBseUVsKSBzdCA9IHBseUVsLm9mZnNldFRvcCAtIG1vdmVzRWwub2Zmc2V0SGVpZ2h0ICsgcGx5RWwub2Zmc2V0SGVpZ2h0O1xuICAgIH1cbiAgICBjb25zb2xlLmxvZyhcInNjcm9sbFRvUGx5XCIsIGN0cmwucGx5LCBzdCk7XG4gICAgaWYgKHR5cGVvZiBzdCA9PSAnbnVtYmVyJykge1xuICAgICAgICBpZiAoc3QgPT0gMCB8fCBzdCA9PSA5OTk5OSkgbW92ZXNFbC5zY3JvbGxUb3AgPSBzdDtcbiAgICAgICAgZWxzZSBpZiAocGx5RWwpIHtcbiAgICAgICAgICAgIHZhciBpc1Ntb290aFNjcm9sbFN1cHBvcnRlZCA9ICdzY3JvbGxCZWhhdmlvcicgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlO1xuICAgICAgICAgICAgaWYoaXNTbW9vdGhTY3JvbGxTdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBwbHlFbC5zY3JvbGxJbnRvVmlldyh7YmVoYXZpb3I6IFwic21vb3RoXCIsIGJsb2NrOiBcImNlbnRlclwifSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBseUVsLnNjcm9sbEludG9WaWV3KGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuLy8gZmxpcFxuZnVuY3Rpb24gdG9nZ2xlT3JpZW50YXRpb24gKGN0cmwpIHtcbiAgICBjdHJsLmZsaXAgPSAhY3RybC5mbGlwO1xuICAgIGN0cmwuY2hlc3Nncm91bmQudG9nZ2xlT3JpZW50YXRpb24oKTtcblxuICAgIC8vIFRPRE86IHBsYXllcnMsIHBvY2tldHMsIGNsb2NrcywgbW9yZXRpbWUgYnV0dG9uIGV0Yy5cbiAgICByZXR1cm47XG5cbiAgICBpZiAoY3RybC52YXJpYW50ID09PSBcInNob2dpXCIpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSBjdHJsLmNoZXNzZ3JvdW5kLnN0YXRlLm9yaWVudGF0aW9uID09PSBcIndoaXRlXCIgPyBcIndoaXRlXCIgOiBcImJsYWNrXCI7XG4gICAgICAgIGN0cmwuc2V0UGllY2VzKGNvbG9yKTtcbiAgICB9O1xuICAgIFxuICAgIGNvbnN0IG5hbWVfdG1wID0gY3RybC5wbGF5ZXJzWzBdO1xuICAgIGN0cmwucGxheWVyc1swXSA9IGN0cmwucGxheWVyc1sxXTtcbiAgICBjdHJsLnBsYXllcnNbMV0gPSBuYW1lX3RtcDtcblxuICAgIGNvbnNvbGUubG9nKFwiRkxJUFwiKTtcbiAgICBpZiAobmVlZFBvY2tldHMoY3RybC52YXJpYW50KSkge1xuICAgICAgICBjb25zdCB0bXAgPSBjdHJsLnBvY2tldHNbMF07XG4gICAgICAgIGN0cmwucG9ja2V0c1swXSA9IGN0cmwucG9ja2V0c1sxXTtcbiAgICAgICAgY3RybC5wb2NrZXRzWzFdID0gdG1wO1xuICAgICAgICBjdHJsLnZwb2NrZXQwID0gcGF0Y2goY3RybC52cG9ja2V0MCwgcG9ja2V0VmlldyhjdHJsLCBjdHJsLmZsaXAgPyBjdHJsLm15Y29sb3IgOiBjdHJsLm9wcGNvbG9yLCBcInRvcFwiKSk7XG4gICAgICAgIGN0cmwudnBvY2tldDEgPSBwYXRjaChjdHJsLnZwb2NrZXQxLCBwb2NrZXRWaWV3KGN0cmwsIGN0cmwuZmxpcCA/IGN0cmwub3BwY29sb3IgOiBjdHJsLm15Y29sb3IsIFwiYm90dG9tXCIpKTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtb3ZlbGlzdFZpZXcgKGN0cmwpIHtcbiAgICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21vdmUtY29udHJvbHMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICBjdHJsLm1vdmVDb250cm9scyA9IHBhdGNoKGNvbnRhaW5lciwgaCgnZGl2LmJ0bi1jb250cm9scycsIFtcbiAgICAgICAgICAgIGgoJ2J1dHRvbiNmbGlwLWJvYXJkJywgeyBvbjogeyBjbGljazogKCkgPT4gdG9nZ2xlT3JpZW50YXRpb24oY3RybCkgfSB9LCBbaCgnaScsIHtwcm9wczoge3RpdGxlOiAnRmxpcCBib2FyZCd9LCBjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tcmVmcmVzaFwiOiB0cnVlfSB9ICksIF0pLFxuICAgICAgICAgICAgaCgnYnV0dG9uI2Zhc3RiYWNrd2FyZCcsIHsgb246IHsgY2xpY2s6ICgpID0+IHNlbGVjdE1vdmUoY3RybCwgMCkgfSB9LCBbaCgnaScsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tZmFzdC1iYWNrd2FyZFwiOiB0cnVlfSB9ICksIF0pLFxuICAgICAgICAgICAgaCgnYnV0dG9uI3N0ZXBiYWNrd2FyZCcsIHsgb246IHsgY2xpY2s6ICgpID0+IHNlbGVjdE1vdmUoY3RybCwgTWF0aC5tYXgoY3RybC5wbHkgLSAxLCAwKSkgfSB9LCBbaCgnaScsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tc3RlcC1iYWNrd2FyZFwiOiB0cnVlfSB9ICksIF0pLFxuICAgICAgICAgICAgaCgnYnV0dG9uI3N0ZXBmb3J3YXJkJywgeyBvbjogeyBjbGljazogKCkgPT4gc2VsZWN0TW92ZShjdHJsLCBNYXRoLm1pbihjdHJsLnBseSArIDEsIGN0cmwuc3RlcHMubGVuZ3RoIC0gMSkpIH0gfSwgW2goJ2knLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLXN0ZXAtZm9yd2FyZFwiOiB0cnVlfSB9ICksIF0pLFxuICAgICAgICAgICAgaCgnYnV0dG9uI2Zhc3Rmb3J3YXJkJywgeyBvbjogeyBjbGljazogKCkgPT4gc2VsZWN0TW92ZShjdHJsLCBjdHJsLnN0ZXBzLmxlbmd0aCAtIDEpIH0gfSwgW2goJ2knLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLWZhc3QtZm9yd2FyZFwiOiB0cnVlfSB9ICksIF0pLFxuICAgICAgICBdKVxuICAgICk7XG4gICAgcmV0dXJuIGgoJ2RpdiNtb3ZlcycsIFtoKCdvbC5tb3ZlbGlzdCNtb3ZlbGlzdCcpXSlcbiAgICB9XG5cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVNb3ZlbGlzdCAoY3RybCkge1xuICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbW92ZWxpc3QnKSBhcyBIVE1MRWxlbWVudDtcbiAgICBjb25zdCBwbHkgPSBjdHJsLnN0ZXBzLmxlbmd0aCAtIDE7XG4gICAgY29uc3QgbW92ZSA9IGN0cmwuc3RlcHNbcGx5XVsnc2FuJ107XG4gICAgY29uc3QgYWN0aXZlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbGkubW92ZS5hY3RpdmUnKTtcbiAgICBpZiAoYWN0aXZlKSBhY3RpdmUuY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJyk7XG4gICAgY29uc3QgZWwgPSBoKCdsaS5tb3ZlJywge2NsYXNzOiB7YWN0aXZlOiB0cnVlfSwgYXR0cnM6IHtwbHk6IHBseX0sIG9uOiB7IGNsaWNrOiAoKSA9PiBzZWxlY3RNb3ZlKGN0cmwsIHBseSkgfX0sIG1vdmUpO1xuICAgIGlmIChwbHkgJSAyID09IDApIHtcbiAgICAgICAgcGF0Y2goY29udGFpbmVyLCBoKCdvbC5tb3ZlbGlzdCNtb3ZlbGlzdCcsIFtlbF0pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwYXRjaChjb250YWluZXIsIGgoJ29sLm1vdmVsaXN0I21vdmVsaXN0JywgW2goJ2xpLm1vdmUuY291bnRlcicsIChwbHkgKyAxKSAvIDIpLCBlbF0pKTtcbiAgICB9XG4gICAgc2Nyb2xsVG9QbHkoY3RybCk7XG59IiwiaW1wb3J0IHsgaW5pdCB9IGZyb20gJ3NuYWJiZG9tJztcclxuaW1wb3J0IGtsYXNzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnO1xyXG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xyXG5pbXBvcnQgcHJvcGVydGllcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJztcclxuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcclxuXHJcbmNvbnN0IHBhdGNoID0gaW5pdChba2xhc3MsIGF0dHJpYnV0ZXMsIHByb3BlcnRpZXMsIGxpc3RlbmVyc10pO1xyXG5cclxuaW1wb3J0IGggZnJvbSAnc25hYmJkb20vaCc7XHJcbmltcG9ydCB7IFZOb2RlIH0gZnJvbSAnc25hYmJkb20vdm5vZGUnO1xyXG5cclxuaW1wb3J0IHsgcmVuZGVyVXNlcm5hbWUgfSBmcm9tICcuL3VzZXInO1xyXG5cclxuXHJcbmZ1bmN0aW9uIHJlbmRlclBsYXllcnMobW9kZWwsIHBsYXllcnMpIHtcclxuICAgIGNvbnNvbGUubG9nKFwicGxheWVyc1wiLCBtb2RlbCwgcGxheWVycyk7XHJcbiAgICBjb25zdCBoZWFkZXIgPSBoKCd0aGVhZCcsIFtoKCd0cicsIFtoKCd0aCcsICdQbGF5ZXJzJyksIF0pXSk7XHJcbiAgICB2YXIgcm93cyA9IHBsYXllcnMubWFwKFxyXG4gICAgICAgIChwbGF5ZXIpID0+IGgoJ3RyJywgW1xyXG4gICAgICAgICAgICBoKCd0ZC5wbGF5ZXItZGF0YScsIFtcclxuICAgICAgICAgICAgICAgIGgoJ2ktc2lkZS5vbmxpbmUnLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLW9ubGluZVwiOiBwbGF5ZXJbXCJvbmxpbmVcIl0sIFwiaWNvbi1vZmZsaW5lXCI6ICFwbGF5ZXJbXCJvbmxpbmVcIl19fSksXHJcbiAgICAgICAgICAgICAgICBoKCdwbGF5ZXInLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnYS51c2VyLWxpbmsnLCB7YXR0cnM6IHtocmVmOiAnL0AvJyArIHBsYXllcltcIl9pZFwiXX19LCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ3BsYXllci10aXRsZScsIFwiIFwiICsgcGxheWVyW1widGl0bGVcIl0gKyBcIiBcIiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYXllcltcIl9pZFwiXSxcclxuICAgICAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICBdKVxyXG4gICAgICAgIF0pXHJcbiAgICAgICAgKTtcclxuICAgIHJldHVybiBbaGVhZGVyLCBoKCd0Ym9keScsIHJvd3MpXTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBsYXllcnNWaWV3KG1vZGVsKTogVk5vZGVbXSB7XHJcbiAgICByZW5kZXJVc2VybmFtZShtb2RlbFtcImhvbWVcIl0sIG1vZGVsW1widXNlcm5hbWVcIl0pO1xyXG5cclxuICAgIHZhciB4bWxodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICB2YXIgdXJsID0gbW9kZWxbXCJob21lXCJdICsgXCIvYXBpL3BsYXllcnNcIjtcclxuXHJcbiAgICB4bWxodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09IDQgJiYgdGhpcy5zdGF0dXMgPT0gMjAwKSB7XHJcbiAgICAgICAgdmFyIG15QXJyID0gSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAgICAgbXlGdW5jdGlvbihteUFycik7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICB4bWxodHRwLm9wZW4oXCJHRVRcIiwgdXJsLCB0cnVlKTtcclxuICAgIHhtbGh0dHAuc2VuZCgpO1xyXG5cclxuICAgIGZ1bmN0aW9uIG15RnVuY3Rpb24oYXJyKSB7XHJcbiAgICAgICAgY29uc3Qgb2xkVk5vZGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVycycpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGFycik7XHJcbiAgICAgICAgaWYgKG9sZFZOb2RlIGluc3RhbmNlb2YgRWxlbWVudCkge1xyXG4gICAgICAgICAgICBwYXRjaChvbGRWTm9kZSBhcyBIVE1MRWxlbWVudCwgaCgndGFibGUjcGxheWVycycsIHJlbmRlclBsYXllcnMobW9kZWwsIGFycikpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc29sZS5sb2cobW9kZWwpO1xyXG4gICAgcmV0dXJuIFtoKCdhc2lkZS5zaWRlYmFyLWZpcnN0JyksXHJcbiAgICAgICAgICAgIGgoJ21haW4ubWFpbicsIFtoKCd0YWJsZSNwbGF5ZXJzJyldKSxcclxuICAgICAgICAgICAgaCgnYXNpZGUuc2lkZWJhci1zZWNvbmQnKSxcclxuICAgICAgICBdO1xyXG59XHJcbiIsImltcG9ydCB7IGgsIGluaXQgfSBmcm9tIFwic25hYmJkb21cIjtcbmltcG9ydCBrbGFzcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2NsYXNzJztcbmltcG9ydCBhdHRyaWJ1dGVzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvYXR0cmlidXRlcyc7XG5pbXBvcnQgcHJvcGVydGllcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJztcbmltcG9ydCBsaXN0ZW5lcnMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9ldmVudGxpc3RlbmVycyc7XG5cbmltcG9ydCAqIGFzIGNnIGZyb20gJ2NoZXNzZ3JvdW5keC90eXBlcyc7XG5pbXBvcnQgeyBkcmFnTmV3UGllY2UgfSBmcm9tICdjaGVzc2dyb3VuZHgvZHJhZyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJ2NoZXNzZ3JvdW5keC90eXBlcyc7XG5cbmltcG9ydCB7IHJvbGVUb1NhbiwgbmVlZFBvY2tldHMsIHBvY2tldFJvbGVzLCBsYyB9IGZyb20gJy4vY2hlc3MnO1xuaW1wb3J0IFJvdW5kQ29udHJvbGxlciBmcm9tICcuL2N0cmwnO1xuXG5jb25zdCBwYXRjaCA9IGluaXQoW2tsYXNzLCBhdHRyaWJ1dGVzLCBwcm9wZXJ0aWVzLCBsaXN0ZW5lcnNdKTtcblxudHlwZSBQb3NpdGlvbiA9ICd0b3AnIHwgJ2JvdHRvbSc7XG5cbmNvbnN0IGV2ZW50TmFtZXMgPSBbJ21vdXNlZG93bicsICd0b3VjaHN0YXJ0J107XG5cbmV4cG9ydCBmdW5jdGlvbiBwb2NrZXRWaWV3KGN0cmw6IFJvdW5kQ29udHJvbGxlciwgY29sb3I6IENvbG9yLCBwb3NpdGlvbjogUG9zaXRpb24pIHtcbiAgY29uc3QgcG9ja2V0ID0gY3RybC5wb2NrZXRzW3Bvc2l0aW9uID09PSAndG9wJyA/IDAgOiAxXTtcbiAgY29uc3QgcGllY2VSb2xlcyA9IE9iamVjdC5rZXlzKHBvY2tldCk7XG4gIHJldHVybiBoKCdkaXYucG9ja2V0LicgKyBwb3NpdGlvbiwge1xuICAgIGNsYXNzOiB7IHVzYWJsZTogdHJ1ZSB9LFxuICAgIGhvb2s6IHtcbiAgICAgIGluc2VydDogdm5vZGUgPT4ge1xuICAgICAgICBldmVudE5hbWVzLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICAgICAgKHZub2RlLmVsbSBhcyBIVE1MRWxlbWVudCkuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCAoZTogY2cuTW91Y2hFdmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKHBvc2l0aW9uID09PSAoY3RybC5mbGlwID8gJ3RvcCcgOiAnYm90dG9tJykpIGRyYWcoY3RybCwgZSk7XG4gICAgICAgICAgfSlcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LCBwaWVjZVJvbGVzLm1hcChyb2xlID0+IHtcbiAgICBsZXQgbmIgPSBwb2NrZXRbcm9sZV0gfHwgMDtcbiAgICByZXR1cm4gaCgncGllY2UuJyArIHJvbGUgKyAnLicgKyBjb2xvciwge1xuICAgICAgYXR0cnM6IHtcbiAgICAgICAgJ2RhdGEtcm9sZSc6IHJvbGUsXG4gICAgICAgICdkYXRhLWNvbG9yJzogY29sb3IsXG4gICAgICAgICdkYXRhLW5iJzogbmIsXG4gICAgICB9XG4gICAgfSk7XG4gIH0pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRyYWcoY3RybDogUm91bmRDb250cm9sbGVyLCBlOiBjZy5Nb3VjaEV2ZW50KTogdm9pZCB7XG4gICAgaWYgKGUuYnV0dG9uICE9PSB1bmRlZmluZWQgJiYgZS5idXR0b24gIT09IDApIHJldHVybjsgLy8gb25seSB0b3VjaCBvciBsZWZ0IGNsaWNrXG4gICAgY29uc3QgZWwgPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudCxcbiAgICByb2xlID0gZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXJvbGUnKSBhcyBjZy5Sb2xlLFxuICAgIGNvbG9yID0gZWwuZ2V0QXR0cmlidXRlKCdkYXRhLWNvbG9yJykgYXMgY2cuQ29sb3IsXG4gICAgbnVtYmVyID0gZWwuZ2V0QXR0cmlidXRlKCdkYXRhLW5iJyk7XG4gICAgaWYgKCFyb2xlIHx8ICFjb2xvciB8fCBudW1iZXIgPT09ICcwJykgcmV0dXJuO1xuICAgIGlmIChjdHJsLmNsaWNrRHJvcCAhPT0gdW5kZWZpbmVkICYmIHJvbGUgPT09IGN0cmwuY2xpY2tEcm9wLnJvbGUpIHtcbiAgICAgICAgY3RybC5jbGlja0Ryb3AgPSB1bmRlZmluZWQ7XG4gICAgICAgIGN0cmwuY2hlc3Nncm91bmQuc2VsZWN0U3F1YXJlKG51bGwpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gU2hvdyBwb3NzaWJsZSBkcm9wIGRlc3RzIG9uIG15IHR1cm4gb25seSBub3QgdG8gbWVzcyB1cCBwcmVkcm9wXG4gICAgaWYgKGN0cmwudHVybkNvbG9yID09PSBjdHJsLm15Y29sb3IpIHtcbiAgICAgICAgY29uc3QgZHJvcERlc3RzID0geyBcImEwXCI6IGN0cmwuZGVzdHNbcm9sZVRvU2FuW3JvbGVdICsgXCJAXCJdIH07XG4gICAgICAgIGN0cmwuY2hlc3Nncm91bmQubmV3UGllY2Uoe1wicm9sZVwiOiByb2xlLCBcImNvbG9yXCI6IGNvbG9yfSwgXCJhMFwiKVxuICAgICAgICBjdHJsLmNoZXNzZ3JvdW5kLnNldCh7XG4gICAgICAgICAgICB0dXJuQ29sb3I6IGNvbG9yLFxuICAgICAgICAgICAgbW92YWJsZToge1xuICAgICAgICAgICAgICAgIGRlc3RzOiBkcm9wRGVzdHMsXG4gICAgICAgICAgICAgICAgc2hvd0Rlc3RzOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGN0cmwuY2hlc3Nncm91bmQuc2VsZWN0U3F1YXJlKFwiYTBcIik7XG4gICAgICAgIGN0cmwuY2hlc3Nncm91bmQuc2V0KHsgbGFzdE1vdmU6IGN0cmwubGFzdG1vdmUgfSk7XG4gICAgfVxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGRyYWdOZXdQaWVjZShjdHJsLmNoZXNzZ3JvdW5kLnN0YXRlLCB7IGNvbG9yLCByb2xlIH0sIGUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZHJvcElzVmFsaWQoZGVzdHM6IGNnLkRlc3RzLCByb2xlOiBjZy5Sb2xlLCBrZXk6IGNnLktleSk6IGJvb2xlYW4ge1xuICAgIC8vIGNvbnNvbGUubG9nKFwiZHJvcERlc3RzOlwiLCBkZXN0cywgcm9sZSwga2V5KVxuICAgIGNvbnN0IGRyb3BzID0gZGVzdHNbcm9sZVRvU2FuW3JvbGVdICsgXCJAXCJdO1xuICAgIC8vIGNvbnNvbGUubG9nKFwiZHJvcHM6XCIsIGRyb3BzKVxuXG4gICAgaWYgKGRyb3BzID09PSB1bmRlZmluZWQgfHwgZHJvcHMgPT09IG51bGwpIHJldHVybiBmYWxzZTtcblxuICAgIHJldHVybiBkcm9wcy5pbmRleE9mKGtleSkgIT09IC0xO1xufVxuXG4vLyBUT0RPOiBhZnJlIDEgbW92ZSBtYWRlIG9ubHkgMSBwb2NrZXQgdXBkYXRlIG5lZWRlZCBhdCBvbmNlLCBubyBuZWVkIHRvIHVwZGF0ZSBib3RoXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlUG9ja2V0cyhjdHJsOiBSb3VuZENvbnRyb2xsZXIsIHZwb2NrZXQwLCB2cG9ja2V0MSk6IHZvaWQge1xuICAgIC8vIHVwZGF0ZSBwb2NrZXRzIGZyb20gZmVuXG4gICAgaWYgKG5lZWRQb2NrZXRzKGN0cmwudmFyaWFudCkpIHtcbiAgICAgICAgY29uc3QgcGFydHMgPSBjdHJsLmZ1bGxmZW4uc3BsaXQoXCIgXCIpO1xuICAgICAgICBjb25zdCBmZW5fcGxhY2VtZW50ID0gcGFydHNbMF07XG4gICAgICAgIHZhciBwb2NrZXRzID0gXCJcIjtcbiAgICAgICAgY29uc3QgYnJhY2tldFBvcyA9IGZlbl9wbGFjZW1lbnQuaW5kZXhPZihcIltcIik7XG4gICAgICAgIGlmIChicmFja2V0UG9zICE9PSAtMSkge1xuICAgICAgICAgICAgcG9ja2V0cyA9IGZlbl9wbGFjZW1lbnQuc2xpY2UoYnJhY2tldFBvcyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjID0gY3RybC5teWNvbG9yWzBdO1xuICAgICAgICBjb25zdCBvID0gY3RybC5vcHBjb2xvclswXTtcbiAgICAgICAgY29uc3Qgcm9sZXMgPSBwb2NrZXRSb2xlcyhjdHJsLnZhcmlhbnQpO1xuICAgICAgICB2YXIgcG8gPSB7fTtcbiAgICAgICAgdmFyIHBjID0ge307XG4gICAgICAgIHJvbGVzLmZvckVhY2gocm9sZSA9PiBwY1tyb2xlXSA9IGxjKHBvY2tldHMsIHJvbGVUb1Nhbltyb2xlXS50b0xvd2VyQ2FzZSgpLCBjPT09KGN0cmwudmFyaWFudD09PSdzaG9naScgPyAnYicgOiAndycpKSk7XG4gICAgICAgIHJvbGVzLmZvckVhY2gocm9sZSA9PiBwb1tyb2xlXSA9IGxjKHBvY2tldHMsIHJvbGVUb1Nhbltyb2xlXS50b0xvd2VyQ2FzZSgpLCBvPT09KGN0cmwudmFyaWFudD09PSdzaG9naScgPyAnYicgOiAndycpKSk7XG4gICAgICAgIGlmIChjdHJsLmZsaXApIHtcbiAgICAgICAgICAgIGN0cmwucG9ja2V0cyA9IFtwYywgcG9dO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3RybC5wb2NrZXRzID0gW3BvLCBwY107XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2cobyxjLHBvLHBjKVxuICAgICAgICBjdHJsLnZwb2NrZXQwID0gcGF0Y2godnBvY2tldDAsIHBvY2tldFZpZXcoY3RybCwgY3RybC5mbGlwID8gY3RybC5teWNvbG9yIDogY3RybC5vcHBjb2xvciwgXCJ0b3BcIikpO1xuICAgICAgICBjdHJsLnZwb2NrZXQxID0gcGF0Y2godnBvY2tldDEsIHBvY2tldFZpZXcoY3RybCwgY3RybC5mbGlwID8gY3RybC5vcHBjb2xvciA6IGN0cmwubXljb2xvciwgXCJib3R0b21cIikpO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IGluaXQgfSBmcm9tICdzbmFiYmRvbSc7XHJcbmltcG9ydCBrbGFzcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2NsYXNzJztcclxuaW1wb3J0IGF0dHJpYnV0ZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9hdHRyaWJ1dGVzJztcclxuaW1wb3J0IHByb3BlcnRpZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9wcm9wcyc7XHJcbmltcG9ydCBsaXN0ZW5lcnMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9ldmVudGxpc3RlbmVycyc7XHJcblxyXG5jb25zdCBwYXRjaCA9IGluaXQoW2tsYXNzLCBhdHRyaWJ1dGVzLCBwcm9wZXJ0aWVzLCBsaXN0ZW5lcnNdKTtcclxuXHJcbmltcG9ydCBoIGZyb20gJ3NuYWJiZG9tL2gnO1xyXG5pbXBvcnQgeyBWTm9kZSB9IGZyb20gJ3NuYWJiZG9tL3Zub2RlJztcclxuXHJcbmltcG9ydCB7IENoZXNzZ3JvdW5kIH0gZnJvbSAnY2hlc3Nncm91bmR4JztcclxuXHJcbmltcG9ydCB7IHJlbmRlclVzZXJuYW1lIH0gZnJvbSAnLi91c2VyJztcclxuaW1wb3J0IHsgVkFSSUFOVFMgfSBmcm9tICcuL2NoZXNzJztcclxuaW1wb3J0IHsgcmVuZGVyVGltZWFnbyB9IGZyb20gJy4vY2xvY2snO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlc3VsdChzdGF0dXMsIHJlc3VsdCkge1xyXG4gICAgdmFyIHRleHQgPSAnJztcclxuICAgIGNvbnNvbGUubG9nKFwicmVzdWx0KClcIiwgc3RhdHVzLCByZXN1bHQpO1xyXG4gICAgc3dpdGNoIChzdGF0dXMpIHtcclxuICAgIGNhc2UgLTI6XHJcbiAgICBjYXNlIC0xOlxyXG4gICAgICAgIHRleHQgPSAnUGxheWluZyByaWdodCBub3cnO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAwOlxyXG4gICAgICAgIHRleHQgPSAnR2FtZSBhYm9ydGVkJztcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgMTpcclxuICAgICAgICB0ZXh0ID0gJ0NoZWNrbWF0ZSc7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIDI6XHJcbiAgICAgICAgdGV4dCA9ICdSZXNpZ25lZCc7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIDM6XHJcbiAgICAgICAgdGV4dCA9ICdTdGFsZW1hdGUnO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSA0OlxyXG4gICAgICAgIHRleHQgPSAnVGltZSBvdXQnO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSA1OlxyXG4gICAgICAgIHRleHQgPSAnRHJhdyc7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIDY6XHJcbiAgICAgICAgdGV4dCA9ICdUaW1lIG91dCc7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIDc6XHJcbiAgICAgICAgdGV4dCA9ICdBYmFuZG9uZWQnO1xyXG4gICAgICAgIGJyZWFrXHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICAgIHRleHQgPSAnKic7XHJcbiAgICAgICAgYnJlYWtcclxuICAgIH1cclxuICAgIHJldHVybiAoc3RhdHVzIDw9IDApID8gdGV4dCA6IHRleHQgKyAnLCAnICsgcmVzdWx0O1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gcmVuZGVyR2FtZXMobW9kZWwsIGdhbWVzKSB7XHJcbi8vICAgICAgICAgICAgICAgIGgoJ2ZuJywgcGxheWVyW1wiZmlyc3RfbmFtZVwiXSksXHJcbi8vICAgICAgICAgICAgICAgIGgoJ2xuJywgcGxheWVyW1wibGFzdF9uYW1lXCJdKSxcclxuLy8gICAgICAgICAgICAgICAgaCgnY291bnRyeScsIHBsYXllcltcImNvdW50cnlcIl0pLFxyXG4gICAgY29uc3QgaGVhZGVyID0gaCgndGhlYWQnLCBbaCgndHInLCBbaCgndGgnLCBtb2RlbFtcInByb2ZpbGVpZFwiXSksIF0pXSk7XHJcbiAgICB2YXIgcm93cyA9IGdhbWVzLm1hcCgoZ2FtZSkgPT4gaChcclxuICAgICAgICAndHInLFxyXG4gICAgICAgIHsgb246IHsgY2xpY2s6ICgpID0+IHsgd2luZG93LmxvY2F0aW9uLmFzc2lnbihtb2RlbFtcImhvbWVcIl0gKyAnLycgKyBnYW1lW1wiX2lkXCJdKTsgfSB9LFxyXG4gICAgICAgIH0sIFtcclxuICAgICAgICBoKCd0ZC5ib2FyZCcsIFtcclxuICAgICAgICAgICAgaCgnc2VsZWN0aW9uLicgKyBWQVJJQU5UU1tnYW1lW1widlwiXV0uYm9hcmQgKyAnLicgKyBWQVJJQU5UU1tnYW1lW1widlwiXV0ucGllY2VzLCBbXHJcbiAgICAgICAgICAgICAgICBoKCdkaXYuY2ctd3JhcC4nICsgVkFSSUFOVFNbZ2FtZVtcInZcIl1dLmNnICsgJy5taW5pJywgeyBob29rOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5zZXJ0OiAodm5vZGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgQ2hlc3Nncm91bmQodm5vZGUuZWxtIGFzIEhUTUxFbGVtZW50LCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb29yZGluYXRlczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aWV3T25seTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZlbjogZ2FtZVtcImZcIl0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnZW9tZXRyeTogVkFSSUFOVFNbZ2FtZVtcInZcIl1dLmdlb21cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfX0pLFxyXG4gICAgICAgICAgICBdKSxcclxuICAgICAgICBdKSxcclxuICAgICAgICBoKCd0ZC5nYW1lcy1pbmZvJywgW1xyXG4gICAgICAgICAgICBoKCdkaXYuaW5mbzAnLCB7YXR0cnM6IHtcImRhdGEtaWNvblwiOiBWQVJJQU5UU1tnYW1lW1widlwiXV0uaWNvbn0sIGNsYXNzOiB7XCJpY29uXCI6IHRydWV9fSwgW1xyXG4gICAgICAgICAgICAgICAgaCgnZGl2JywgW1xyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2Rpdi50YycsIGdhbWVbXCJiXCJdICsgXCIrXCIgKyBnYW1lW1wiaVwiXSArIFwiIOKAoiBDYXN1YWwg4oCiIFwiICsgZ2FtZVtcInZcIl0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2luZm8tZGF0ZScsIHthdHRyczoge3RpbWVzdGFtcDogZ2FtZVtcImRcIl19fSksXHJcbiAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgIGgoJ2RpdicsIFtcclxuICAgICAgICAgICAgICAgIGgoJ3BsYXllcicsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdhLnVzZXItbGluaycsIHthdHRyczoge2hyZWY6ICcvQC8nICsgZ2FtZVtcInVzXCJdWzBdfX0sIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgncGxheWVyLXRpdGxlJywgXCIgXCIgKyBnYW1lW1wid3RcIl0gKyBcIiBcIiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGdhbWVbXCJ1c1wiXVswXSxcclxuICAgICAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgaCgndnMnLCAnLScpLFxyXG4gICAgICAgICAgICAgICAgaCgncGxheWVyJywgW1xyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2EudXNlci1saW5rJywge2F0dHJzOiB7aHJlZjogJy9ALycgKyBnYW1lW1widXNcIl1bMV19fSwgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdwbGF5ZXItdGl0bGUnLCBcIiBcIiArIGdhbWVbXCJidFwiXSArIFwiIFwiKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZ2FtZVtcInVzXCJdWzFdLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICBoKCdkaXYuaW5mby1yZXN1bHQnLCB7XHJcbiAgICAgICAgICAgICAgICBjbGFzczoge1xyXG4gICAgICAgICAgICAgICAgICAgIFwid2luXCI6IChnYW1lW1wiclwiXSA9PT0gJzEtMCcgJiYgZ2FtZVtcInVzXCJdWzBdID09PSBtb2RlbFtcInByb2ZpbGVpZFwiXSkgfHwgKGdhbWVbXCJyXCJdID09PSAnMC0xJyAmJiBnYW1lW1widXNcIl1bMV0gPT09IG1vZGVsW1wicHJvZmlsZWlkXCJdKSxcclxuICAgICAgICAgICAgICAgICAgICBcImxvc2VcIjogKGdhbWVbXCJyXCJdID09PSAnMC0xJyAmJiBnYW1lW1widXNcIl1bMF0gPT09IG1vZGVsW1wicHJvZmlsZWlkXCJdKSB8fCAoZ2FtZVtcInJcIl0gPT09ICcxLTAnICYmIGdhbWVbXCJ1c1wiXVsxXSA9PT0gbW9kZWxbXCJwcm9maWxlaWRcIl0pLFxyXG4gICAgICAgICAgICAgICAgfX0sIHJlc3VsdChnYW1lW1wic1wiXSwgZ2FtZVtcInJcIl0pXHJcbiAgICAgICAgICAgICksXHJcbiAgICAgICAgXSlcclxuICAgICAgICBdKVxyXG4gICAgICAgICk7XHJcbiAgICByZXR1cm4gW2hlYWRlciwgaCgndGJvZHknLCByb3dzKV07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwcm9maWxlVmlldyhtb2RlbCk6IFZOb2RlW10ge1xyXG4gICAgcmVuZGVyVXNlcm5hbWUobW9kZWxbXCJob21lXCJdLCBtb2RlbFtcInVzZXJuYW1lXCJdKTtcclxuXHJcbiAgICB2YXIgeG1saHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gICAgdmFyIHVybCA9IG1vZGVsW1wiaG9tZVwiXSArIFwiL2FwaS9cIiArIG1vZGVsW1wicHJvZmlsZWlkXCJdICtcIi9nYW1lc1wiO1xyXG5cclxuICAgIHhtbGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT0gNCAmJiB0aGlzLnN0YXR1cyA9PSAyMDApIHtcclxuICAgICAgICB2YXIgbXlBcnIgPSBKU09OLnBhcnNlKHRoaXMucmVzcG9uc2VUZXh0KTtcclxuICAgICAgICBteUZ1bmN0aW9uKG15QXJyKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIHhtbGh0dHAub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xyXG4gICAgeG1saHR0cC5zZW5kKCk7XHJcblxyXG4gICAgZnVuY3Rpb24gbXlGdW5jdGlvbihhcnIpIHtcclxuICAgICAgICBjb25zdCBvbGRWTm9kZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lcycpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGFycik7XHJcbiAgICAgICAgaWYgKG9sZFZOb2RlIGluc3RhbmNlb2YgRWxlbWVudCkge1xyXG4gICAgICAgICAgICBwYXRjaChvbGRWTm9kZSBhcyBIVE1MRWxlbWVudCwgaCgndGFibGUjZ2FtZXMnLCByZW5kZXJHYW1lcyhtb2RlbCwgYXJyKSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZW5kZXJUaW1lYWdvKCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc29sZS5sb2cobW9kZWwpO1xyXG4gICAgcmV0dXJuIFtoKCdhc2lkZS5zaWRlYmFyLWZpcnN0JyksXHJcbiAgICAgICAgICAgIGgoJ21haW4ubWFpbicsIFtoKCd0YWJsZSNnYW1lcycpXSksXHJcbiAgICAgICAgICAgIGgoJ2FzaWRlLnNpZGViYXItc2Vjb25kJyksXHJcbiAgICAgICAgXTtcclxufVxyXG4iLCJpbXBvcnQgeyBoLCBpbml0IH0gZnJvbSBcInNuYWJiZG9tXCI7XHJcbmltcG9ydCBrbGFzcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2NsYXNzJztcclxuaW1wb3J0IGF0dHJpYnV0ZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9hdHRyaWJ1dGVzJztcclxuaW1wb3J0IGxpc3RlbmVycyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJztcclxuaW1wb3J0IHRvVk5vZGUgZnJvbSAnc25hYmJkb20vdG92bm9kZSc7XHJcblxyXG5pbXBvcnQgeyBrZXkycG9zIH0gZnJvbSAnY2hlc3Nncm91bmR4L3V0aWwnO1xyXG5cclxuaW1wb3J0IHsgaXNQcm9tb3Rpb24sIG1hbmRhdG9yeVByb21vdGlvbiwgcHJvbW90aW9uUm9sZXMsIHJvbGVUb1NhbiB9IGZyb20gJy4vY2hlc3MnO1xyXG5cclxuY29uc3QgcGF0Y2ggPSBpbml0KFtrbGFzcywgYXR0cmlidXRlcywgbGlzdGVuZXJzXSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihjdHJsKSB7XHJcblxyXG4gICAgbGV0IHByb21vdGluZzogYW55ID0gZmFsc2U7XHJcbiAgICBsZXQgcm9sZXM6IHN0cmluZ1tdID0gW107XHJcbiAgICBmdW5jdGlvbiBzdGFydChvcmlnLCBkZXN0LCBtZXRhKSB7XHJcbiAgICAgICAgY29uc3QgZ3JvdW5kID0gY3RybC5nZXRHcm91bmQoKTtcclxuICAgICAgICBpZiAoaXNQcm9tb3Rpb24oY3RybC52YXJpYW50LCBncm91bmQuc3RhdGUucGllY2VzW2Rlc3RdLCBvcmlnLCBkZXN0LCBtZXRhKSkge1xyXG4gICAgICAgICAgICBjb25zdCBjb2xvciA9IGN0cmwubXljb2xvcjtcclxuICAgICAgICAgICAgY29uc3Qgb3JpZW50YXRpb24gPSBncm91bmQuc3RhdGUub3JpZW50YXRpb247XHJcbiAgICAgICAgICAgIGNvbnN0IG1vdmluZ1JvbGUgPSBncm91bmQuc3RhdGUucGllY2VzW2Rlc3RdLnJvbGU7XHJcbiAgICAgICAgICAgIHJvbGVzID0gcHJvbW90aW9uUm9sZXMoY3RybC52YXJpYW50LCBtb3ZpbmdSb2xlKTtcclxuXHJcbiAgICAgICAgICAgIHN3aXRjaCAoY3RybC52YXJpYW50KSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCJzaG9naVwiOlxyXG4gICAgICAgICAgICAgICAgaWYgKG1hbmRhdG9yeVByb21vdGlvbihtb3ZpbmdSb2xlLCBkZXN0LCBjb2xvcikpIHtcclxuICAgICAgICAgICAgICAgICAgICBwcm9tb3RlKGdyb3VuZCwgZGVzdCwgJ3AnICsgZ3JvdW5kLnN0YXRlLnBpZWNlc1tkZXN0XS5yb2xlKTtcclxuICAgICAgICAgICAgICAgICAgICBjdHJsLnNlbmRNb3ZlKG9yaWcsIGRlc3QsICcrJyk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGRyYXdfcHJvbW8oZGVzdCwgY29sb3IsIG9yaWVudGF0aW9uKTtcclxuICAgICAgICAgICAgICAgICAgICBwcm9tb3RpbmcgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9yaWc6IG9yaWcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc3Q6IGRlc3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrOiBjdHJsLnNlbmRNb3ZlLFxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ21ha3J1ayc6XHJcbiAgICAgICAgICAgICAgICBwcm9tb3RlKGdyb3VuZCwgZGVzdCwgJ21ldCcpO1xyXG4gICAgICAgICAgICAgICAgY3RybC5zZW5kTW92ZShvcmlnLCBkZXN0LCAnbScpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NpdHR1eWluJzpcclxuICAgICAgICAgICAgICAgIHByb21vdGUoZ3JvdW5kLCBkZXN0LCAnZmVyeicpO1xyXG4gICAgICAgICAgICAgICAgY3RybC5zZW5kTW92ZShvcmlnLCBkZXN0LCAnZicpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICBkcmF3X3Byb21vKGRlc3QsIGNvbG9yLCBvcmllbnRhdGlvbik7XHJcbiAgICAgICAgICAgICAgICBwcm9tb3RpbmcgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3JpZzogb3JpZyxcclxuICAgICAgICAgICAgICAgICAgICBkZXN0OiBkZXN0LFxyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrOiBjdHJsLnNlbmRNb3ZlLFxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcblxyXG4gICAgZnVuY3Rpb24gcHJvbW90ZShnLCBrZXksIHJvbGUpIHtcclxuICAgICAgICB2YXIgcGllY2VzID0ge307XHJcbiAgICAgICAgdmFyIHBpZWNlID0gZy5zdGF0ZS5waWVjZXNba2V5XTtcclxuICAgICAgICBpZiAoZy5zdGF0ZS5waWVjZXNba2V5XS5yb2xlID09PSByb2xlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBwaWVjZXNba2V5XSA9IHtcclxuICAgICAgICAgICAgICAgIGNvbG9yOiBwaWVjZS5jb2xvcixcclxuICAgICAgICAgICAgICAgIHJvbGU6IHJvbGUsXHJcbiAgICAgICAgICAgICAgICBwcm9tb3RlZDogdHJ1ZVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBnLnNldFBpZWNlcyhwaWVjZXMpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZHJhd19wcm9tbyhkZXN0LCBjb2xvciwgb3JpZW50YXRpb24pIHtcclxuICAgICAgICB2YXIgY29udGFpbmVyID0gdG9WTm9kZShkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdleHRlbnNpb24nKSBhcyBOb2RlKTtcclxuICAgICAgICBwYXRjaChjb250YWluZXIsIHJlbmRlclByb21vdGlvbihkZXN0LCBjb2xvciwgb3JpZW50YXRpb24pKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBkcmF3X25vX3Byb21vKCkge1xyXG4gICAgICAgIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZXh0ZW5zaW9uX2Nob2ljZScpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIHBhdGNoKGNvbnRhaW5lciwgaCgnZXh0ZW5zaW9uJykpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGZpbmlzaChyb2xlKSB7XHJcbiAgICAgICAgaWYgKHByb21vdGluZykge1xyXG4gICAgICAgICAgICBkcmF3X25vX3Byb21vKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb21vdGVkID0gcHJvbW90ZShjdHJsLmdldEdyb3VuZCgpLCBwcm9tb3RpbmcuZGVzdCwgcm9sZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb21vID0gY3RybC52YXJpYW50ID09PSBcInNob2dpXCIgPyBwcm9tb3RlZCA/IFwiK1wiIDogXCJcIiA6IHJvbGVUb1Nhbltyb2xlXS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgICAgICBpZiAocHJvbW90aW5nLmNhbGxiYWNrKSBwcm9tb3RpbmcuY2FsbGJhY2socHJvbW90aW5nLm9yaWcsIHByb21vdGluZy5kZXN0LCBwcm9tbyk7XHJcbiAgICAgICAgICAgIHByb21vdGluZyA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgZnVuY3Rpb24gY2FuY2VsKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ0FOQ0VMIHByb21vdGlvblwiKTtcclxuICAgICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBiaW5kKGV2ZW50TmFtZTogc3RyaW5nLCBmOiAoZTogRXZlbnQpID0+IHZvaWQsIHJlZHJhdykge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGluc2VydCh2bm9kZSkge1xyXG4gICAgICAgICAgICAgICAgdm5vZGUuZWxtLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBlID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBmKGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWRyYXcpIHJlZHJhdygpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXM7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcmVuZGVyUHJvbW90aW9uKGRlc3QsIGNvbG9yLCBvcmllbnRhdGlvbikge1xyXG4gICAgICAgIGNvbnN0IGRpbSA9IGN0cmwuZ2V0R3JvdW5kKCkuc3RhdGUuZGltZW5zaW9uc1xyXG4gICAgICAgIGNvbnN0IGZpcnN0UmFua0lzMCA9IGRpbS5oZWlnaHQgPT09IDEwO1xyXG4gICAgICAgIHZhciBsZWZ0ID0gKGRpbS53aWR0aCAtIGtleTJwb3MoZGVzdCwgZmlyc3RSYW5rSXMwKVswXSkgKiAoMTAwIC8gZGltLndpZHRoKTtcclxuICAgICAgICBpZiAob3JpZW50YXRpb24gPT09IFwid2hpdGVcIikgbGVmdCA9ICgxMDAgLyBkaW0ud2lkdGgpICogKGRpbS53aWR0aCAtIDEpIC0gbGVmdDtcclxuICAgICAgICB2YXIgdmVydGljYWwgPSBjb2xvciA9PT0gb3JpZW50YXRpb24gPyBcInRvcFwiIDogXCJib3R0b21cIjtcclxuICAgICAgICByZXR1cm4gaChcclxuICAgICAgICAgICAgXCJkaXYjZXh0ZW5zaW9uX2Nob2ljZS5cIiArIHZlcnRpY2FsLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBob29rOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5zZXJ0OiB2bm9kZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVsID0gdm5vZGUuZWxtIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gY2FuY2VsKCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbC5hZGRFdmVudExpc3RlbmVyKFwiY29udGV4dG1lbnVcIiwgZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcm9sZXMubWFwKChzZXJ2ZXJSb2xlLCBpKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdG9wID0gKGNvbG9yID09PSBvcmllbnRhdGlvbiA/IGkgOiBkaW0uaGVpZ2h0IC0xIC0gaSkgKiAoMTAwIC8gZGltLmhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaChcclxuICAgICAgICAgICAgICAgICAgICBcInNxdWFyZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXR0cnM6IHsgc3R5bGU6IFwidG9wOiBcIiArIHRvcCArIFwiJTtsZWZ0OiBcIiArIGxlZnQgKyBcIiVcIiB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBob29rOiBiaW5kKFwiY2xpY2tcIiwgZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmluaXNoKHNlcnZlclJvbGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBmYWxzZSlcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIFtoKFwicGllY2UuXCIgKyBzZXJ2ZXJSb2xlICsgXCIuXCIgKyBjb2xvcildXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzdGFydCxcclxuICAgIH07XHJcbn1cclxuIiwiLy8gaHR0cDovL2pzZmlkZGxlLm5ldC9NaXNzb3VsYUxvcmVuem8vZ2ZuNm9iM2ovXG4vLyBodHRwczovL2dpdGh1Yi5jb20vb3JuaWNhci9saWxhL2Jsb2IvbWFzdGVyL3VpL2NvbW1vbi9zcmMvcmVzaXplLnRzXG5cbmltcG9ydCAqIGFzIGNnIGZyb20gJ2NoZXNzZ3JvdW5keC90eXBlcyc7XG5cbmV4cG9ydCB0eXBlIE1vdWNoRXZlbnQgPSBNb3VzZUV2ZW50ICYgVG91Y2hFdmVudDtcblxuLy9leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZXNpemVIYW5kbGUoZWxzOiBjZy5FbGVtZW50cywgcHJlZjogbnVtYmVyLCBwbHk6IG51bWJlcikge1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmVzaXplSGFuZGxlKGVsczogY2cuRWxlbWVudHMpIHtcblxuLy8gIGlmICghcHJlZikgcmV0dXJuO1xuICBpZiAodHJ1ZSkgcmV0dXJuO1xuXG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2ctcmVzaXplJyk7XG4gIGVscy5jb250YWluZXIuYXBwZW5kQ2hpbGQoZWwpO1xuXG4gIGNvbnN0IG1vdXNlbW92ZUV2ZW50ID0gJ21vdXNlbW92ZSc7XG4gIGNvbnN0IG1vdXNldXBFdmVudCA9ICdtb3VzZXVwJztcblxuICBlbC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoc3RhcnQ6IE1vdWNoRXZlbnQpID0+IHtcblxuICAgIHN0YXJ0LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICBjb25zdCBzdGFydFBvcyA9IGV2ZW50UG9zaXRpb24oc3RhcnQpITtcbiAgICBjb25zdCBpbml0aWFsWm9vbSA9IDEwMDsgIC8vcGFyc2VJbnQoZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5nZXRQcm9wZXJ0eVZhbHVlKCctLXpvb20nKSk7XG4gICAgbGV0IHpvb20gPSBpbml0aWFsWm9vbTtcbi8qXG4gICAgY29uc3Qgc2F2ZVpvb20gPSB3aW5kb3cubGljaGVzcy5kZWJvdW5jZSgoKSA9PiB7XG4gICAgICAkLmFqYXgoeyBtZXRob2Q6ICdwb3N0JywgdXJsOiAnL3ByZWYvem9vbT92PScgKyAoMTAwICsgem9vbSkgfSk7XG4gICAgfSwgNzAwKTtcbiovXG5cbiAgICBjb25zdCBzZXRab29tID0gKHpvb206IG51bWJlcikgPT4ge1xuICAgICAgICBjb25zdCBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jZy13cmFwJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICAgIGlmIChlbCkge1xuLy8gICAgICAgICAgICBjb25zdCBiYXNlV2lkdGggPSBkaW1lbnNpb25zW1ZBUklBTlRTW3RoaXMudmFyaWFudF0uZ2VvbV0ud2lkdGggKiAodGhpcy52YXJpYW50ID09PSBcInNob2dpXCIgPyA1MiA6IDY0KTtcbi8vICAgICAgICAgICAgY29uc3QgYmFzZUhlaWdodCA9IGRpbWVuc2lvbnNbVkFSSUFOVFNbdGhpcy52YXJpYW50XS5nZW9tXS5oZWlnaHQgKiAodGhpcy52YXJpYW50ID09PSBcInNob2dpXCIgPyA2MCA6IDY0KTtcbiAgICAgICAgICAgIGNvbnN0IGJhc2VXaWR0aCA9IHBhcnNlSW50KCBkb2N1bWVudC5kZWZhdWx0VmlldyEuZ2V0Q29tcHV0ZWRTdHlsZSggZWwgKS53aWR0aCB8fCAnJywgMTApO1xuICAgICAgICAgICAgY29uc3QgYmFzZUhlaWdodCA9IHBhcnNlSW50KGRvY3VtZW50LmRlZmF1bHRWaWV3IS5nZXRDb21wdXRlZFN0eWxlKCBlbCApLmhlaWdodCB8fCAnJywgMTApO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYmFzZVdpZHRoLCBiYXNlSGVpZ2h0LCB6b29tKTtcbiAgICAgICAgICAgIGNvbnN0IHB4dyA9IGAke3pvb20gLyAxMDAgKiBiYXNlV2lkdGh9cHhgO1xuICAgICAgICAgICAgY29uc3QgcHhoID0gYCR7em9vbSAvIDEwMCAqIGJhc2VIZWlnaHR9cHhgO1xuICAgICAgICAgICAgZWwuc3R5bGUud2lkdGggPSBweHc7XG4gICAgICAgICAgICBlbC5zdHlsZS5oZWlnaHQgPSBweGg7XG4gICAgICAgICAgICBjb25zdCBldiA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdFdmVudCcpO1xuICAgICAgICAgICAgZXYuaW5pdEV2ZW50KCdjaGVzc2dyb3VuZC5yZXNpemUnLCBmYWxzZSwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5kaXNwYXRjaEV2ZW50KGV2KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlc2l6ZSA9IChtb3ZlOiBNb3VjaEV2ZW50KSA9PiB7XG5cbiAgICAgIGNvbnN0IHBvcyA9IGV2ZW50UG9zaXRpb24obW92ZSkhO1xuICAgICAgY29uc3QgZGVsdGEgPSBwb3NbMF0gLSBzdGFydFBvc1swXSArIHBvc1sxXSAtIHN0YXJ0UG9zWzFdO1xuXG4gICAgICB6b29tID0gTWF0aC5yb3VuZChNYXRoLm1pbigxNTAsIE1hdGgubWF4KDAsIGluaXRpYWxab29tICsgZGVsdGEgLyAxMCkpKTtcblxuLy8gICAgICBkb2N1bWVudC5ib2R5LnNldEF0dHJpYnV0ZSgnc3R5bGUnLCAnLS16b29tOicgKyB6b29tKTtcbi8vICAgICAgd2luZG93LmxpY2hlc3MuZGlzcGF0Y2hFdmVudCh3aW5kb3csICdyZXNpemUnKTtcbiAgICAgIHNldFpvb20oem9vbSk7XG4vLyAgICAgIHNhdmVab29tKCk7XG4gICAgfTtcblxuICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCgncmVzaXppbmcnKTtcblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIobW91c2Vtb3ZlRXZlbnQsIHJlc2l6ZSk7XG5cbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKG1vdXNldXBFdmVudCwgKCkgPT4ge1xuICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihtb3VzZW1vdmVFdmVudCwgcmVzaXplKTtcbiAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZSgncmVzaXppbmcnKTtcbiAgICB9LCB7IG9uY2U6IHRydWUgfSk7XG4gIH0pO1xuLypcbiAgaWYgKHByZWYgPT0gMSkge1xuICAgIGNvbnN0IHRvZ2dsZSA9IChwbHk6IG51bWJlcikgPT4gZWwuY2xhc3NMaXN0LnRvZ2dsZSgnbm9uZScsIHBseSA+PSAyKTtcbiAgICB0b2dnbGUocGx5KTtcbiAgICB3aW5kb3cubGljaGVzcy5wdWJzdWIub24oJ3BseScsIHRvZ2dsZSk7XG4gIH1cblxuICBhZGROYWcoZWwpO1xuKi9cbn1cblxuZnVuY3Rpb24gZXZlbnRQb3NpdGlvbihlOiBNb3VjaEV2ZW50KTogW251bWJlciwgbnVtYmVyXSB8IHVuZGVmaW5lZCB7XG4gIGlmIChlLmNsaWVudFggfHwgZS5jbGllbnRYID09PSAwKSByZXR1cm4gW2UuY2xpZW50WCwgZS5jbGllbnRZXTtcbiAgaWYgKGUudG91Y2hlcyAmJiBlLnRhcmdldFRvdWNoZXNbMF0pIHJldHVybiBbZS50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFgsIGUudGFyZ2V0VG91Y2hlc1swXS5jbGllbnRZXTtcbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cbi8qXG5mdW5jdGlvbiBhZGROYWcoZWw6IEhUTUxFbGVtZW50KSB7XG5cbiAgY29uc3Qgc3RvcmFnZSA9IHdpbmRvdy5saWNoZXNzLnN0b3JhZ2UubWFrZUJvb2xlYW4oJ3Jlc2l6ZS1uYWcnKTtcbiAgaWYgKHN0b3JhZ2UuZ2V0KCkpIHJldHVybjtcblxuICB3aW5kb3cubGljaGVzcy5sb2FkQ3NzUGF0aCgnbmFnLWNpcmNsZScpO1xuICBlbC50aXRsZSA9ICdEcmFnIHRvIHJlc2l6ZSc7XG4gIGVsLmlubmVySFRNTCA9ICc8ZGl2IGNsYXNzPVwibmFnLWNpcmNsZVwiPjwvZGl2Pic7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIod2luZG93LmxpY2hlc3MubW91c2Vkb3duRXZlbnQsICgpID0+IHtcbiAgICBzdG9yYWdlLnNldCh0cnVlKTtcbiAgICBlbC5pbm5lckhUTUwgPSAnJztcbiAgfSwgeyBvbmNlOiB0cnVlIH0pO1xuXG4gIHNldFRpbWVvdXQoKCkgPT4gc3RvcmFnZS5zZXQodHJ1ZSksIDE1MDAwKTtcbn1cbiovIiwiaW1wb3J0IHsgaCB9IGZyb20gXCJzbmFiYmRvbVwiO1xyXG5pbXBvcnQgeyBWTm9kZSB9IGZyb20gJ3NuYWJiZG9tL3Zub2RlJztcclxuaW1wb3J0IFJvdW5kQ29udHJvbGxlciBmcm9tICcuL2N0cmwnO1xyXG5pbXBvcnQgeyBWQVJJQU5UUyB9IGZyb20gJy4vY2hlc3MnO1xyXG5pbXBvcnQgeyB0aW1lYWdvLCByZW5kZXJUaW1lYWdvIH0gZnJvbSAnLi9jbG9jayc7XHJcblxyXG5cclxuZnVuY3Rpb24gcnVuR3JvdW5kKHZub2RlOiBWTm9kZSwgbW9kZWwpIHtcclxuICAgIGNvbnN0IGVsID0gdm5vZGUuZWxtIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgY29uc3QgY3RybCA9IG5ldyBSb3VuZENvbnRyb2xsZXIoZWwsIG1vZGVsKTtcclxuICAgIGNvbnN0IGNnID0gY3RybC5jaGVzc2dyb3VuZDtcclxuICAgIHdpbmRvd1snY2cnXSA9IGNnO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcm91bmRWaWV3KG1vZGVsKTogVk5vZGVbXSB7XHJcbiAgICBjb25zb2xlLmxvZyhcInJvdW5kVmlldyBtb2RlbD1cIiwgbW9kZWwpO1xyXG4gICAgdmFyIHBsYXllclRvcCwgcGxheWVyQm90dG9tLCB0aXRsZVRvcCwgdGl0bGVCb3R0b20sIGRhdGFJY29uO1xyXG4gICAgZGF0YUljb24gPSBWQVJJQU5UU1ttb2RlbFtcInZhcmlhbnRcIl1dLmljb247XHJcbiAgICBpZiAobW9kZWxbXCJ1c2VybmFtZVwiXSAhPT0gbW9kZWxbXCJ3cGxheWVyXCJdICYmIG1vZGVsW1widXNlcm5hbWVcIl0gIT09IG1vZGVsW1wiYnBsYXllclwiXSkge1xyXG4gICAgICAgIC8vIHNwZWN0YXRvciBnYW1lIHZpZXdcclxuICAgICAgICBwbGF5ZXJUb3AgPSBtb2RlbFtcInZhcmlhbnRcIl0gPT09ICdzaG9naScgPyBtb2RlbFtcIndwbGF5ZXJcIl0gOiBtb2RlbFtcImJwbGF5ZXJcIl07XHJcbiAgICAgICAgcGxheWVyQm90dG9tID0gbW9kZWxbXCJ2YXJpYW50XCJdID09PSAnc2hvZ2knID8gbW9kZWxbXCJicGxheWVyXCJdIDogbW9kZWxbXCJ3cGxheWVyXCJdO1xyXG4gICAgICAgIHRpdGxlVG9wID0gbW9kZWxbXCJ2YXJpYW50XCJdID09PSAnc2hvZ2knID8gbW9kZWxbXCJ3dGl0bGVcIl0gOiBtb2RlbFtcImJ0aXRsZVwiXTtcclxuICAgICAgICB0aXRsZUJvdHRvbSA9IG1vZGVsW1widmFyaWFudFwiXSA9PT0gJ3Nob2dpJyA/IG1vZGVsW1wiYnRpdGxlXCJdIDogbW9kZWxbXCJ3dGl0bGVcIl07XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHBsYXllclRvcCA9IG1vZGVsW1widXNlcm5hbWVcIl0gPT09IG1vZGVsW1wid3BsYXllclwiXSA/IG1vZGVsW1wiYnBsYXllclwiXSA6IG1vZGVsW1wid3BsYXllclwiXTtcclxuICAgICAgICBwbGF5ZXJCb3R0b20gPSBtb2RlbFtcInVzZXJuYW1lXCJdO1xyXG4gICAgICAgIHRpdGxlVG9wID0gbW9kZWxbXCJ1c2VybmFtZVwiXSA9PT0gbW9kZWxbXCJ3cGxheWVyXCJdID8gbW9kZWxbXCJidGl0bGVcIl0gOiBtb2RlbFtcInd0aXRsZVwiXTtcclxuICAgICAgICB0aXRsZUJvdHRvbSA9IG1vZGVsW1widXNlcm5hbWVcIl0gPT09IG1vZGVsW1wid3BsYXllclwiXSA/IG1vZGVsW1wid3RpdGxlXCJdIDogbW9kZWxbXCJidGl0bGVcIl07XHJcbiAgICB9XHJcbi8vICAgIGlmIChtb2RlbFtcImxldmVsXCJdID4gMCkge1xyXG4vLyAgICAgICAgaWYgKHRpdGxlVG9wID09PSBcIkJPVFwiKSBwbGF5ZXJUb3AgKz0gJyBsZXZlbCAnICsgbW9kZWxbJ2xldmVsJ107XHJcbi8vICAgICAgICBpZiAodGl0bGVCb3R0b20gPT09IFwiQk9UXCIpIHBsYXllckJvdHRvbSArPSAnIGxldmVsICcgKyBtb2RlbFsnbGV2ZWwnXTtcclxuLy8gICAgfTtcclxuICAgIHJlbmRlclRpbWVhZ28oKTtcclxuICAgIHJldHVybiBbaCgnYXNpZGUuc2lkZWJhci1maXJzdCcsIFtcclxuICAgICAgICAgICAgICAgIGgoJ2Rpdi5nYW1lLWluZm8nLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnZGl2LmluZm8wJywge2F0dHJzOiB7XCJkYXRhLWljb25cIjogZGF0YUljb259LCBjbGFzczoge1wiaWNvblwiOiB0cnVlfX0sIFtcclxuLy8gICAgICAgICAgICAgICAgICAgICAgICBoKCdkaXYuaW5mbzEnLCB7YXR0cnM6IHtcImRhdGEtaWNvblwiOiAobW9kZWxbXCJjaGVzczk2MFwiXSA9PT0gJ1RydWUnKSA/IFwiVlwiIDogXCJcIn0sIGNsYXNzOiB7XCJpY29uXCI6IHRydWV9fSwgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdkaXYnLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoKCdkaXYudGMnLCBtb2RlbFtcImJhc2VcIl0gKyBcIitcIiArIG1vZGVsW1wiaW5jXCJdICsgXCIg4oCiIENhc3VhbCDigKIgXCIgKyBtb2RlbFtcInZhcmlhbnRcIl0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTnVtYmVyKG1vZGVsW1wic3RhdHVzXCJdKSA+PSAwID8gaCgnaW5mby1kYXRlJywge2F0dHJzOiB7dGltZXN0YW1wOiBtb2RlbFtcImRhdGVcIl19fSwgdGltZWFnbyhtb2RlbFtcImRhdGVcIl0pKSA6IFwiUGxheWluZyByaWdodCBub3dcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnZGl2LnBsYXllci1kYXRhJywgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdpLXNpZGUub25saW5lJywge2NsYXNzOiB7XCJpY29uXCI6IHRydWUsIFwiaWNvbi13aGl0ZVwiOiB0cnVlfSB9ICksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ3BsYXllcicsIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2EudXNlci1saW5rJywge2F0dHJzOiB7aHJlZjogJy9ALycgKyBtb2RlbFtcIndwbGF5ZXJcIl19fSwgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGgoJ3BsYXllci10aXRsZScsIFwiIFwiICsgbW9kZWxbXCJ3dGl0bGVcIl0gKyBcIiBcIiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxbXCJ3cGxheWVyXCJdICsgXCIgKDE1MDA/KVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2Rpdi5wbGF5ZXItZGF0YScsIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnaS1zaWRlLm9ubGluZScsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tYmxhY2tcIjogdHJ1ZX0gfSApLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdwbGF5ZXInLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoKCdhLnVzZXItbGluaycsIHthdHRyczoge2hyZWY6ICcvQC8nICsgbW9kZWxbXCJicGxheWVyXCJdfX0sIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoKCdwbGF5ZXItdGl0bGUnLCBcIiBcIiArIG1vZGVsW1wiYnRpdGxlXCJdICsgXCIgXCIpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsW1wiYnBsYXllclwiXSArIFwiICgxNTAwPylcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgaCgnZGl2LnJvdW5kY2hhdCNyb3VuZGNoYXQnKSxcclxuICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgIGgoJ21haW4ubWFpbicsIFtcclxuICAgICAgICAgICAgICAgIGgoJ3NlbGVjdGlvbi4nICsgVkFSSUFOVFNbbW9kZWxbXCJ2YXJpYW50XCJdXS5ib2FyZCArICcuJyArIFZBUklBTlRTW21vZGVsW1widmFyaWFudFwiXV0ucGllY2VzLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnZGl2LmNnLXdyYXAuJyArIFZBUklBTlRTW21vZGVsW1widmFyaWFudFwiXV0uY2csXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgaG9vazogeyBpbnNlcnQ6ICh2bm9kZSkgPT4gcnVuR3JvdW5kKHZub2RlLCBtb2RlbCl9LFxyXG4gICAgICAgICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICBoKCdhc2lkZS5zaWRlYmFyLXNlY29uZCcsIFtcclxuICAgICAgICAgICAgICAgIGgoJ2RpdiNwb2NrZXQtd3JhcHBlcicsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdkaXYuJyArIFZBUklBTlRTW21vZGVsW1widmFyaWFudFwiXV0ucGllY2VzICsgJy4nICsgbW9kZWxbXCJ2YXJpYW50XCJdLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2Rpdi5jZy13cmFwLnBvY2tldCcsIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2RpdiNwb2NrZXQwJyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICBoKCdkaXYjY2xvY2swJyksXHJcbiAgICAgICAgICAgICAgICBoKCdkaXYucm91bmQtZGF0YScsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdyb3VuZC1wbGF5ZXInLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnZGl2LnBsYXllci1kYXRhJywgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdpLXNpZGUub25saW5lI3RvcC1wbGF5ZXInLCB7Y2xhc3M6IHtcImljb25cIjogdHJ1ZSwgXCJpY29uLW9ubGluZVwiOiBmYWxzZSwgXCJpY29uLW9mZmxpbmVcIjogdHJ1ZX19KSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaCgncGxheWVyJywgW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaCgnYS51c2VyLWxpbmsnLCB7YXR0cnM6IHtocmVmOiAnL0AvJyArIHBsYXllclRvcH19LCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaCgncGxheWVyLXRpdGxlJywgXCIgXCIgKyB0aXRsZVRvcCArIFwiIFwiKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGF5ZXJUb3AsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGgoJ3JhdGluZycsIFwiMTUwMD9cIiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ2RpdiNtb3ZlLWNvbnRyb2xzJyksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnZGl2I21vdmVsaXN0JyksXHJcbiAgICAgICAgICAgICAgICAgICAgaCgnZGl2I2FmdGVyLWdhbWUnKSxcclxuICAgICAgICAgICAgICAgICAgICBoKCdkaXYjZ2FtZS1jb250cm9scycpLFxyXG4gICAgICAgICAgICAgICAgICAgIGgoJ3JvdW5kLXBsYXllcicsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdkaXYucGxheWVyLWRhdGEnLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2ktc2lkZS5vbmxpbmUjYm90dG9tLXBsYXllcicsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tb25saW5lXCI6IGZhbHNlLCBcImljb24tb2ZmbGluZVwiOiB0cnVlfX0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdwbGF5ZXInLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoKCdhLnVzZXItbGluaycsIHthdHRyczoge2hyZWY6ICcvQC8nICsgcGxheWVyQm90dG9tfX0sIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoKCdwbGF5ZXItdGl0bGUnLCBcIiBcIiArIHRpdGxlQm90dG9tICsgXCIgXCIpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBsYXllckJvdHRvbSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaCgncmF0aW5nJywgXCIxNTAwP1wiKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICAgIGgoJ2RpdiNjbG9jazEnKSxcclxuICAgICAgICAgICAgICAgIGgoJ2RpdiNwb2NrZXQtd3JhcHBlcicsIFtcclxuICAgICAgICAgICAgICAgICAgICBoKCdkaXYuJyArIFZBUklBTlRTW21vZGVsW1widmFyaWFudFwiXV0ucGllY2VzICsgJy4nICsgbW9kZWxbXCJ2YXJpYW50XCJdLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2Rpdi5jZy13cmFwLnBvY2tldCcsIFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2RpdiNwb2NrZXQxJyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgICBoKCdkaXYjZmxpcCcpLFxyXG4gICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgaCgndW5kZXItbGVmdCcsIFwiU3BlY3RhdG9yc1wiKSxcclxuICAgICAgICAgICAgaCgndW5kZXItYm9hcmQnLCBbaCgnZGl2LiN1bmRlci1ib2FyZCcpXSksXHJcbiAgICAgICAgICAgIGgoJ3VuZGVyLXJpZ2h0JywgW2goJ2RpdiN6b29tJyldKSxcclxuICAgICAgICBdO1xyXG59XHJcbiIsImNsYXNzIHNvdW5kcyB7XHJcbiAgICB0cmFja3M7XHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLnRyYWNrcyA9IHtcclxuICAgICAgICAgICAgR2VuZXJpY05vdGlmeTogeyBuYW1lOiAnR2VuZXJpY05vdGlmeScsIHF0eSA6IDEsIHBvb2wgOiBbXSwgaW5kZXggOiAwfSxcclxuICAgICAgICAgICAgTW92ZTogeyBuYW1lOiAnTW92ZScsIHF0eSA6IDgsIHBvb2wgOiBbXSwgaW5kZXggOiAwfSxcclxuICAgICAgICAgICAgQ2FwdHVyZTogeyBuYW1lOiAnQ2FwdHVyZScsIHF0eSA6IDQsIHBvb2wgOiBbXSwgaW5kZXggOiAwfSxcclxuICAgICAgICAgICAgQ2hlY2s6IHsgbmFtZTogJ0NoZWNrJywgcXR5IDogMiwgcG9vbCA6IFtdLCBpbmRleCA6IDB9LFxyXG4gICAgICAgICAgICBEcmF3OiB7IG5hbWU6ICdEcmF3JywgcXR5IDogMSwgcG9vbCA6IFtdLCBpbmRleCA6IDB9LFxyXG4gICAgICAgICAgICBWaWN0b3J5OiB7IG5hbWU6ICdWaWN0b3J5JywgcXR5IDogMSwgcG9vbCA6IFtdLCBpbmRleCA6IDB9LFxyXG4gICAgICAgICAgICBEZWZlYXQ6IHsgbmFtZTogJ0RlZmVhdCcsIHF0eSA6IDEsIHBvb2wgOiBbXSwgaW5kZXggOiAwfSxcclxuICAgICAgICAgICAgU2hvZ2lNb3ZlOiB7IG5hbWU6ICdrb21hb3RvNScsIHF0eSA6IDgsIHBvb2wgOiBbXSwgaW5kZXggOiAwfSxcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMudHJhY2tzKS5mb3JFYWNoKGtleSA9PiB7XHJcbiAgICAgICAgICAgIGxldCB0eXBlID0gdGhpcy50cmFja3Nba2V5XTtcclxuICAgICAgICAgICAgdHlwZS5wb29sID0gdGhpcy5idWlsZE1hbnlTb3VuZHModHlwZS5uYW1lLCB0eXBlLnF0eSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBidWlsZE1hbnlTb3VuZHMgPSAoZmlsZSwgcXR5KSA9PiB7XHJcbiAgICAgICAgdmFyIHNvdW5kQXJyYXk6IEhUTUxBdWRpb0VsZW1lbnRbXSA9IFtdO1xyXG4gICAgICAgIHdoaWxlIChzb3VuZEFycmF5Lmxlbmd0aCA8IHF0eSkge1xyXG4gICAgICAgICAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYXVkaW9cIik7XHJcbiAgICAgICAgICAgIGlmIChlbC5jYW5QbGF5VHlwZSgnYXVkaW8vbXBlZycpKSB7XHJcbiAgICAgICAgICAgICAgICBlbC5zcmMgPSAnL3N0YXRpYy9zb3VuZC8nICsgZmlsZSArICcubXAzJztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGVsLnNyYyA9ICcvc3RhdGljL3NvdW5kLycgKyBmaWxlICsgJy5vZ2cnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsLnNldEF0dHJpYnV0ZShcInByZWxvYWRcIiwgXCJub25lXCIpO1xyXG4gICAgICAgICAgICBlbC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbiAgICAgICAgICAgIHNvdW5kQXJyYXkucHVzaChlbCk7XHJcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZWwpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gc291bmRBcnJheTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGdldFNvdW5kID0gKHR5cGUpID0+IHtcclxuICAgICAgICBsZXQgdGFyZ2V0ID0gdGhpcy50cmFja3NbdHlwZV07XHJcbiAgICAgICAgdGFyZ2V0LmluZGV4ID0gKHRhcmdldC5pbmRleCArIDEpICUgdGFyZ2V0LnBvb2wubGVuZ3RoO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiU09VTkQ6XCIsIHR5cGUsIHRhcmdldC5pbmRleCk7XHJcbiAgICAgICAgcmV0dXJuIHRhcmdldC5wb29sW3RhcmdldC5pbmRleF07XHJcbiAgICB9XHJcblxyXG4gICAgZ2VuZXJpY05vdGlmeSgpIHsgdGhpcy5nZXRTb3VuZCgnR2VuZXJpY05vdGlmeScpLnBsYXkoKTsgfTtcclxuICAgIG1vdmUoKSB7IHRoaXMuZ2V0U291bmQoJ01vdmUnKS5wbGF5KCk7IH07XHJcbiAgICBjYXB0dXJlKCkgeyB0aGlzLmdldFNvdW5kKCdDYXB0dXJlJykucGxheSgpOyB9O1xyXG4gICAgY2hlY2soKSB7IHRoaXMuZ2V0U291bmQoJ0NoZWNrJykucGxheSgpOyB9O1xyXG4gICAgZHJhdygpIHsgdGhpcy5nZXRTb3VuZCgnRHJhdycpLnBsYXkoKTsgfTtcclxuICAgIHZpY3RvcnkoKSB7IHRoaXMuZ2V0U291bmQoJ1ZpY3RvcnknKS5wbGF5KCk7IH07XHJcbiAgICBkZWZlYXQoKSB7IHRoaXMuZ2V0U291bmQoJ0RlZmVhdCcpLnBsYXkoKTsgfTtcclxuICAgIHNob2dpbW92ZSgpIHsgdGhpcy5nZXRTb3VuZCgnU2hvZ2lNb3ZlJykucGxheSgpOyB9O1xyXG59XHJcblxyXG5leHBvcnQgY29uc3Qgc291bmQgPSBuZXcoc291bmRzKTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjaGFuZ2VDU1MoY3NzRmlsZSkge1xyXG4gICAgLy8gY3NzIGZpbGUgaW5kZXggaW4gdGVtcGxhdGUuaHRtbFxyXG4gICAgdmFyIGNzc0xpbmtJbmRleCA9IDE7XHJcbiAgICBpZiAoY3NzRmlsZS5pbmNsdWRlcyhcInhpYW5ncWlcIikpIHtcclxuICAgICAgICBjc3NMaW5rSW5kZXggPSAzO1xyXG4gICAgfSBlbHNlIGlmIChjc3NGaWxlLmluY2x1ZGVzKFwic2hvZ2lcIikpIHtcclxuICAgICAgICBjc3NMaW5rSW5kZXggPSAyO1xyXG4gICAgfSBlbHNlIGlmIChjc3NGaWxlLmluY2x1ZGVzKFwiY2FwYXNlaVwiKSkge1xyXG4gICAgICAgIGNzc0xpbmtJbmRleCA9IDQ7XHJcbiAgICB9XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImxpbmtcIikuaXRlbShjc3NMaW5rSW5kZXgpIS5zZXRBdHRyaWJ1dGUoXCJocmVmXCIsIGNzc0ZpbGUpO1xyXG59XHJcbiIsImltcG9ydCB7IGluaXQgfSBmcm9tICdzbmFiYmRvbSc7XG5pbXBvcnQga2xhc3MgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9jbGFzcyc7XG5pbXBvcnQgYXR0cmlidXRlcyBmcm9tICdzbmFiYmRvbS9tb2R1bGVzL2F0dHJpYnV0ZXMnO1xuaW1wb3J0IHByb3BlcnRpZXMgZnJvbSAnc25hYmJkb20vbW9kdWxlcy9wcm9wcyc7XG5pbXBvcnQgbGlzdGVuZXJzIGZyb20gJ3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMnO1xuXG5jb25zdCBwYXRjaCA9IGluaXQoW2tsYXNzLCBhdHRyaWJ1dGVzLCBwcm9wZXJ0aWVzLCBsaXN0ZW5lcnNdKTtcblxuaW1wb3J0IGggZnJvbSAnc25hYmJkb20vaCc7XG5cbi8vIFRPRE86IGNyZWF0ZSBsb2dvdXQgYnV0dG9uIHdoZW4gbG9nZ2VkIGluXG4vKlxuZnVuY3Rpb24gbG9naW4oaG9tZSkge1xuICAgIGNvbnNvbGUubG9nKFwiTE9HSU4gV0lUSCBMSUNIRVNTXCIpO1xuICAgIHdpbmRvdy5sb2NhdGlvbi5hc3NpZ24oaG9tZSArICcvbG9naW4nKTtcbn07XG4qL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlclVzZXJuYW1lKGhvbWUsIHVzZXJuYW1lKSB7XG4gICAgY29uc29sZS5sb2coXCJyZW5kZXJVc2VybmFtZSgpXCIsIHVzZXJuYW1lLCBob21lKTtcbiAgICB2YXIgb2xkVk5vZGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndXNlcm5hbWUnKTtcbiAgICBpZiAob2xkVk5vZGUgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgICAgIG9sZFZOb2RlLmlubmVySFRNTCA9ICcnO1xuICAgICAgICBwYXRjaChvbGRWTm9kZSBhcyBIVE1MRWxlbWVudCwgaCgnZGl2I3VzZXJuYW1lJywgaCgnYS5uYXYtbGluaycsIHthdHRyczoge2hyZWY6ICcvQC8nICsgdXNlcm5hbWV9fSwgdXNlcm5hbWUpKSk7XG4gICAgfTtcbi8qXG4gICAgLy8gaWYgdXNlcm5hbWUgaXMgbm90IGEgbG9nZ2VkIGluIG5hbWUgbG9naW4gZWxzZSBsb2dvdXQgYnV0dG9uXG4gICAgdmFyIG9sZFZOb2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZ2luJyk7XG4gICAgaWYgKG9sZFZOb2RlIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgICBvbGRWTm9kZS5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgcGF0Y2gob2xkVk5vZGUgYXMgSFRNTEVsZW1lbnQsIGgoJ2J1dHRvbicsIHsgb246IHsgY2xpY2s6ICgpID0+IGxvZ2luKGhvbWUpIH0sIHByb3BzOiB7dGl0bGU6ICdMb2dpbiB3aXRoIExpY2hlc3MnfSB9LCBbaCgnaScsIHtjbGFzczoge1wiaWNvblwiOiB0cnVlLCBcImljb24tc2lnbi1pblwiOiB0cnVlfSB9ICksIF0pKTtcbiAgICB9O1xuKi9cbn1cbiJdfQ==
