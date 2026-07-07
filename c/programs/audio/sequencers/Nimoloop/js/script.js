/*
    Nimoloop 3.0
    Web tracker by Jankenpopp.com
*/

import { AudioClock } from "../../../../../../42/lib/audio/AudioClock.js";

var tempo = 120;
var context;
var masterGain;
var masterGainValue = 0.75;
var masterAux;
/** @type {AudioClock} */
var clock;
var metro = [];
var step = 0;
var currentPartition = 0;
var delay;
var delayWet = 0.25;
var swing = 0;
var song = [];
var lastSongPos = -1;
var isPlaying = false;
// var preview = false;
var navigation = "click"; // click or dblclick
var soundKit = "jankenpopp";
let songTile = "Untitled";
let shiftPressed = false;

let partitions = [
    { id: 0, beat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], bpm: 120, swing: 0, decay: 128, delay: 0.25, step: 0, songMode: false, tonic: 'A', scale: 'Chromatic', advanced: false, kit: soundKit },
    { id: 1, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 2, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 3, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 4, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 5, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 6, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 7, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 8, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 9, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 10, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 11, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 12, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 13, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 14, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 15, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
    { id: 16, beat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pitch: [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69], speedFactor: 1, step: 15, decay: [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128], mute: false, mod: 16, direction: 'forward', delay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], reverse: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], free: false },
]

let blocks = [];
var muteStates = []
var soloCell = -1;
let advancedEl = document.getElementById('advanced');
let cells = document.querySelectorAll(".cell");
let playSong = document.getElementById('playSong');

let metricStep = [];
function initMetricStep() {
    metricStep = [];
    for (let y = 0; y < partitions.length; y++) {
        metricStep[y] = [];
        for (let x = 0; x < partitions[y].beat.length; x++) {
            metricStep[y][x] = 0;
        }
    }
}

// let previewAudio = new Audio()

var leftClickDown = false;
var rightClickDown = false;
var draggin = false;
var cellHover = -1;
var cellClipBoard = {}
var patternClipBoard = {}

document.getElementById('background').addEventListener('click', (event) => {
    if (currentPartition != 0 && !draggin) {
        currentPartition = 0;
        updateSequencerInterface(currentPartition);
    }
});

document.getElementById('background').addEventListener('contextmenu', (event) => {
    partitions[currentPartition].mute = !partitions[currentPartition].mute;
    updateSequencerInterface();
});

document.getElementById('background').addEventListener('pointerup', (event) => {
    if (event.button == 0) {
        draggin = false;
        return
    }
});

document.getElementById('background').addEventListener('auxclick', (event) => {
    if (currentPartition == 0) return;
    if (event.button != 1) return;
    if (!partitions[currentPartition].mute && !isSolo()) {
        for (let i = 1; i < partitions.length; i++) {
            muteStates[i] = partitions[i].mute;
            partitions[i].mute = true;
        }
        partitions[currentPartition].mute = false;
    } else {
        if (!partitions[currentPartition].mute && isSolo()) {
            for (let i = 1; i < partitions.length; i++) {
                partitions[i].mute = muteStates[i];
            }
        } else {
            muteStates = []
            soloCell = currentPartition;
            for (let i = 1; i < partitions.length; i++) {
                muteStates[i] = partitions[i].mute;
                partitions[i].mute = true;
            }
            partitions[currentPartition].mute = false;
        }
    }
    updateSequencerInterface();
});

cells.forEach((cell, index) => {

    cell.addEventListener('dblclick', (event) => {
        if (currentPartition == 0 && navigation == 'dblclick') {
            currentPartition = partitions[0].beat[index];
            updateSequencerInterface(currentPartition);
        }
    });

    cell.addEventListener('pointerdown', (event) => {
        if (event.button == 0) {
            if (currentPartition == 0) {
                if (navigation != 'dblclick') {
                    currentPartition = partitions[0].beat[index];
                    updateSequencerInterface(currentPartition);
                }
                /*
                if (preview && !isPlaying) {
                    previewAudio.currentTime = 0
                    previewAudio.src = getSamplePath(index + 1)
                    previewAudio.play()
                }
                */
            } else {
                let y = currentPartition;
                partitions[y].beat[index] = currentPartition;
                updateSequencerInterface(y);
            }
        }
        if (event.button == 2) {
            handleCellRightClick(index);
        }
    });

    cell.firstChild.addEventListener('pointerenter', () => {
        if (leftClickDown) {
            draggin = true;
            handleCellLeftClick(index);
            return
        }
        if (rightClickDown) {
            handleCellRightClick(index);
            return
        }
        // if (preview && !isPlaying && !advancedEl.checked && currentPartition == 0) {
        //     previewAudio.currentTime = 0
        //     previewAudio.src = getSamplePath(index + 1)
        //     previewAudio.play()
        // }
    });

    cell.addEventListener('pointerenter', () => {
        cellHover = index;
    });
    cell.addEventListener('pointerleave', () => {
        cellHover = -1;
    });

    cell.addEventListener('pointerup', (event) => {
        if (event.button == 0) {
            draggin = false;
            leftClickDown = false;
            return
        }
        if (event.button == 2) {
            rightClickDown = false;
            return
        }
    });

    function handleCellLeftClick(index) {
        if (currentPartition != 0) {
            let y = currentPartition;
            partitions[y].beat[index] = currentPartition;
            updateSequencerInterface(y);
        }
    }

    function handleCellRightClick(index) {
        let y = currentPartition;
        if (partitions[y].beat[index] != 0 && y != 0) {
            partitions[y].beat[index] = 0;
            updateSequencerInterface(y);
        }
        if (y == 0) {
            partitions[index + 1].mute = !partitions[index + 1].mute
            updateSequencerInterface(y);
        }
    }

    cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });

    cell.onwheel = function (event) {
        event.preventDefault();
        const { deltaX: x, deltaY: y } = event;
        if (event.deltaY < 0) {
            if (currentPartition != 0) {
                let note = partitions[currentPartition].beat[index]
                if (note != 0) {
                    nextNotePattern(currentPartition, index, note, 1);
                }
            }
        } else {
            if (currentPartition != 0) {
                let note = partitions[currentPartition].beat[index]
                if (note != 0) {
                    nextNotePattern(currentPartition, index, note, -1);
                }
            }
        }
    }

    cell.addEventListener('auxclick', (event) => {
        event.preventDefault();
        if (event.button === 1) {
            let y = currentPartition;
            if (y == 0) {
                if (partitions[index + 1]) {
                    if (!partitions[index + 1].mute && !isSolo()) {
                        for (let i = 1; i < partitions.length; i++) {
                            muteStates[i] = partitions[i].mute;
                            partitions[i].mute = true;
                            cells[i - 1].classList.add('muted');
                        }
                        partitions[index + 1].mute = false;
                        cells[index].classList.remove('muted');
                    } else {
                        if (!partitions[index + 1].mute && isSolo()) {
                            cells.forEach((cell, index) => {
                                cells[index].classList.remove('muted');
                            })
                            for (let i = 1; i < partitions.length; i++) {
                                partitions[i].mute = muteStates[i];
                                if (partitions[i].mute) {
                                    cells[i - 1].classList.add('muted');
                                }
                            }
                        } else {
                            muteStates = []
                            soloCell = index;
                            for (let i = 1; i < partitions.length; i++) {
                                muteStates[i] = partitions[i].mute;
                                partitions[i].mute = true;
                                cells[i - 1].classList.add('muted');
                            }
                            partitions[index + 1].mute = false;
                            cells[index].classList.remove('muted');
                        }
                    }
                }
            } else {
                if (partitions[currentPartition].mod != index && index != 0) {
                    partitions[currentPartition].mod = index;
                } else {
                    partitions[currentPartition].mod = 16;
                }
                updateSequencerInterface();
            }
        }
    });
});

var availableMetrics = [
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [1, 1, 0, 0],
    [0, 0, 1, 1],
    [0, 1, 1, 1],
    [1, 0, 1, 1],
    [1, 1, 0, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
];

function nextNotePattern(part, index, note, direction) {
    let instrument;
    let metric;
    if (Array.isArray(note)) {
        instrument = determineInstrument(note);
        metric = [];
        for (let i = 0; i < note.length; i++) {
            metric[i] = (note[i] > 0) ? 1 : 0;
        }
    } else {
        instrument = note;
        metric = [1, 1, 1, 1];
    }
    let mectricsPos;
    for (let i = 0; i < availableMetrics.length; i++) {
        if (arraySame(availableMetrics[i], metric)) {
            mectricsPos = i;
            break;
        }
    }
    let newMetricPos = mectricsPos + direction;
    if (newMetricPos < 0) { newMetricPos = availableMetrics.length - 1 }
    metric = [...availableMetrics[(newMetricPos) % availableMetrics.length]];
    for (let i = 0; i < metric.length; i++) {
        if (metric[i] > 0) {
            metric[i] = instrument;
        }
    }
    partitions[part].beat[index] = metric;
    updateSequencerInterface(part);
}

function updateSequencerInterface(y) {
    if (currentPartition != 0) {
        document.getElementById('trackControls').style.display = 'initial';
        document.getElementById('pitch').value = '69';
        document.getElementById('decay').value = '127';
        document.getElementById('trackSpeed').innerText = partitions[currentPartition].speedFactor;
        document.getElementById('dir').src = 'img/' + partitions[currentPartition].direction + '.png';
        document.getElementById('songControls').style.display = 'none';
        document.getElementById('delay').checked = partitions[currentPartition].delay[0];
        document.getElementById('reverse').checked = partitions[currentPartition].reverse[0];
        document.getElementById('free').checked = !partitions[currentPartition].free;
        let modMute = false;
        cells.forEach((cell, index) => {
            cell.classList.remove('muted');
            cell.classList.remove('mod');
            cell.classList.remove('modMute');
            if (modMute) {
                cells[index].classList.add('modMute');
            }
            if (partitions[currentPartition].mod == index) {
                cells[index].classList.add('mod');
                modMute = true;
            }
        })
        if (partitions[currentPartition].mute) {
            cells.forEach((cell, index) => {
                cells[index].classList.add('muted');
            })
        }
        if (document.getElementById("harmonyInterface").getAttribute("aria-pressed") === "true") {
            document.getElementById("tcptch").style.setProperty("display", "initial", "important");
        }
    } else {
        document.getElementById('trackControls').style.display = 'none'
        document.getElementById('songControls').style.display = 'initial'
        document.getElementById('delayWet').value = delayWet

        cells.forEach((cell, index) => {
            cells[index].classList.remove('muted');
            cells[index].classList.remove('mod');
            cells[index].classList.remove('modMute');
            if (partitions[index + 1]) {
                if (partitions[index + 1].mute) {
                    cells[index].classList.add('muted');
                }
            }
        })
        document.getElementById("tcptch").style.setProperty("display", "none", "important");
    }
    y = currentPartition;
    for (let x = 0; x < partitions[y].beat.length; x++) {
        cells[x].firstChild.style.backgroundSize = '100%';
        cells[x].firstChild.style.backgroundPosition = 'center';
        // cells[x].firstChild.style.backgroundRepeat = 'no-repeat';
        if (!Array.isArray(partitions[y].beat[x]) || currentPartition == 0) {
            cells[x].firstChild.style.backgroundImage = 'url(kits/' + soundKit + '/' + partitions[y].beat[x] + '.png)';
        } else {
            displayCellMetric(x, partitions[y].beat[x])
        }
    }
}

updateSequencerInterface(currentPartition);

function setTempo() {
    if (clock == undefined) return;
    let newTempo = Number(document.getElementById("tempo").value);
    clock.timeStretch(context.currentTime, metro, tempo / newTempo)
    tempo = newTempo
    if (delay != undefined) {
        delay.setBPM(tempo)
    }
    partitions[0].bpm = tempo;
}

document.getElementById('playButton').addEventListener('click', play);
document.getElementById('stopButton').addEventListener('click', stop);

async function initContext() {
    if (context == undefined) {
        context = new AudioContext();
        masterGain = context.createGain();
        masterGain.gain.value = masterGainValue;
        masterAux = context.createMediaStreamDestination();
        masterGain.connect(context.destination);
        masterGain.connect(masterAux);
        delay = new Delay(context, tempo, 12, delayWet);
        clock = new AudioClock(context);
        await clock.init()
        await loadSamples();
    }
}

async function loadSamples() {
    let undones = []
    for (let i = 1; i <= partitions.length - 1; i++) {
        undones.push(loadTrack(i));
    }
    await Promise.all(undones);
    await getStyle();
}

async function play() {
    stop();
    isPlaying = true;
    await initContext();
    if (!isPlaying) return;
    initMetricStep();
    var timeTick = 0.0625 * 2; // 16 steps
    swing = Number(document.getElementById('swing').value);
    var swingOffset = timeTick * swing * 0.5;
    if (metro.length > 0) {
        metro.forEach(event => event.clear());
    }
    metro = [];
    clock.stop();
    /// main seq
    for (var i = 0; i < 16; i++) {
        var offset = (i % 4 === 1 || i % 4 === 3) ? swingOffset : 0;
        var scheduledTime = timeTick * i + offset + clock.context.currentTime;

        metro[i] = clock
            .callbackAtTime((index => () => tick(index))(i), scheduledTime)
            .tolerance({ early: 0, late: 1 })
            .repeat(timeTick * 16);
    }
    // midi seq
    var midiClockTick = (timeTick * 4) / 24;  // Temps entre chaque tick MIDI Clock
    for (var i = 0; i < 24 * 4; i++) { // 24 ticks x 4 temps
        var scheduledClockTime = midiClockTick * i + clock.context.currentTime;
        metro.push(
            clock.callbackAtTime(() => {
                if (midiOutput) midiOutput.send([0xF8]);
                if (midiChosen) {
                    midiSelect.selectedIndex = midiOutputSelected;
                    midiChosen = false;
                }
            }, scheduledClockTime)
                .tolerance({ early: 0, late: 1 })
                .repeat(midiClockTick * 24 * 4)
        );
    }
    step = 0;
    tick();
    clock.start();
    tempo = 120;
    setTempo();
    document.getElementById('playButton').style.display = "none";
    document.getElementById('stopButton').style.display = "initial";
    document.getElementById('swing').classList.add('disable');
}

function stop() {
    if (!clock) return
    isPlaying = false;
    if (midiOutput) {
        midiOutput.send([0xFC]); // Stop MIDI (0xFC)
        stopAllMidiNotes();
    }
    clock.stop()
    for (let i = 0; i < metro.length; i++) {
        metro[i].clear()
    }
    step = 0;
    cells.forEach.call(cells, function (el) { el.classList.remove("currentStep"); });
    document.getElementById('playButton').style.display = "initial";
    document.getElementById('stopButton').style.display = "none";
    lastSongPos = -1;
    document.getElementById('swing').classList.remove('disable');
}

function tick(i) {
    if (isPlaying) {
        sequencerStep();
        step = step + 1;
    }
}

function getTrackStep(track) {
    const numSteps = track.mod;
    const adjustedStep = Math.floor(step / track.speedFactor);
    if (numSteps === 1) {
        return 0;
    }
    if (track.direction === 'forward') {
        return adjustedStep % numSteps;
    } else if (track.direction === 'backward') {
        return (numSteps - 1) - (adjustedStep % numSteps);
    } else if (track.direction === 'roundtrip') {
        const doubleNumSteps = (numSteps - 1) * 2;
        const positionInCycle = adjustedStep % doubleNumSteps;
        if (positionInCycle < numSteps) {
            return positionInCycle;
        } else {
            return doubleNumSteps - positionInCycle;
        }
    } else {
        return adjustedStep % numSteps;
    }
}

// auto filter, not used.
var filterLow;
var filterHigh;
var convolver;
var modulationFrequency = 0.2;
var modulationAmplitude = 0.15;
var autoFilterInterval = 5;
var autoFilterCurrentTime = 0;
var autoFilterUpdateInterval;
var autoFilterWetGain;
var autoFilterDryGain;
function createReverbImpulse(duration, decay) {
    const sampleRate = context.sampleRate;
    const length = sampleRate * duration;
    const impulse = context.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
        const n = length - i;
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
    }
    return impulse;
}
function limitNumberWithinRange(num, min, max) {
    return Math.min(Math.max(num, min), max);
}
function logslider(position, imin, imax, omin, omax) {
    var minp = imin;
    var maxp = imax;
    var minv = Math.log(omin);
    var maxv = Math.log(omax);
    var scale = (maxv - minv) / (maxp - minp);
    return Math.exp(minv + scale * (position - minp));
}
function adjustedLogslider(position, imin, imax, omin, omax) {
    let normalizedPos = (position - imin) / (imax - imin);
    normalizedPos = Math.pow(normalizedPos, 0.4);
    let newPosition = imin + normalizedPos * (imax - imin);
    return logslider(newPosition, imin, imax, omin, omax);
}
function autoFilterUpdate(time) {
    const modulationValue = 0.5 + Math.sin(2 * Math.PI * modulationFrequency * time) * modulationAmplitude;
    const lowFrequency = Math.round(logslider(limitNumberWithinRange(modulationValue, 0.25, 0.75) - 0.25, 0, 0.5, 10, 22050));
    const highFrequency = Math.round(logslider(limitNumberWithinRange(modulationValue, 0.75, 1) - 0.75, 0, 0.5, 10, 22050));
    filterLow.frequency.value = lowFrequency;
    filterHigh.frequency.value = highFrequency;
}
function initAutoFilter() {
    filterLow = context.createBiquadFilter();
    filterLow.type = 'lowpass';
    filterLow.frequency.value = 22050;
    filterLow.Q.value = 10;
    filterHigh = context.createBiquadFilter();
    filterHigh.type = 'highpass';
    filterHigh.frequency.value = 10;
    filterHigh.Q.value = 10;
    convolver = context.createConvolver();
    convolver.buffer = createReverbImpulse(10, 5);
    clearInterval(autoFilterUpdateInterval);
    autoFilterUpdateInterval = setInterval(() => {
        autoFilterUpdate(autoFilterCurrentTime);
        autoFilterCurrentTime += autoFilterInterval / 10000;
    }, autoFilterInterval);
    autoFilterWetGain = context.createGain();
    autoFilterWetGain.gain.value = 0.5; // Mix
    autoFilterDryGain = context.createGain();
    autoFilterDryGain.gain.value = 1 - autoFilterWetGain.gain.value;
    filterLow.connect(filterHigh);
    filterHigh.connect(convolver);
    convolver.connect(autoFilterWetGain);
    autoFilterWetGain.connect(context.destination); // out
    filterHigh.connect(autoFilterDryGain);
    //autoFilterDryGain.connect(context.destination); // out
}

function sequencerStep() {
    cells.forEach(el => el.classList.remove("currentStep"));
    if (step % 8 == 0 && playSong.checked) {
        let songStep = Math.floor((step) / 16) % (song.length);
        displaySongFeedBackCurrentBlock(songStep)
        if (blocks[song[songStep]] != undefined) {
            if (lastSongPos != song[songStep]) {
                loadPartition(blocks[song[songStep]]);
                lastSongPos = song[songStep];
                setCurrentBlock(song[songStep]);
            }
        }
    }
    partitions.forEach(track => {
        var trackStep = getTrackStep(track);
        var trackModOnePlay = false;
        var trackRandomPlay = false;
        if (track.mod == 1 && (step % track.speedFactor == 0)) { trackModOnePlay = true } // track.mod 1 case

        if (track.direction == 'random' && (step % track.speedFactor == 0)) {
            trackRandomPlay = true;
        }
        if (track.id != 0 && (track.step != trackStep || trackModOnePlay || trackRandomPlay)) {
            track.step = trackStep;
            if (trackRandomPlay) {
                track.step = Math.floor(Math.random() * track.mod)
            }
            if (track.id != 0) {
                let y = track.id;
                let note;
                let partitionStep = partitions[y].beat[track.step];
                if (!Array.isArray(partitionStep)) {
                    note = partitionStep;
                } else {
                    note = undefined;
                    metricStep[y][track.step] = Math.floor((step / track.speedFactor) / track.mod) % 4;
                    let metricMod = metricStep[y][track.step];
                    if (partitionStep[metricMod] > 0) {
                        note = determineInstrument(partitionStep);
                    }
                }
                if (note !== undefined && soundBank[note] !== undefined) {
                    let currentPitch = note2rate(midiToNoteName(partitions[y].pitch[track.step]));
                    let currentDecay = partitions[y].decay[track.step];
                    let currentDelay = 0;
                    currentDelay = partitions[y].delay[track.step];
                    let bufferNode;
                    if (shiftPressed && currentPartition == track.id) {
                        partitions[y].reverse[track.step] = Number(document.getElementById('reverse').checked);
                    }
                    if (shiftPressed && currentPartition == track.id) {
                        partitions[y].delay[track.step] = Number(document.getElementById('delay').checked);
                    }
                    if (partitions[y].reverse[track.step] == 1) {
                        var originalBuffer = soundBank[y].createNode().buffer;
                        var reversedBuffer = reverseAudioBuffer(originalBuffer, context);
                        bufferNode = context.createBufferSource();
                        bufferNode.buffer = reversedBuffer;
                    } else {
                        bufferNode = soundBank[y].createNode();
                    }
                    bufferNode.disconnect();
                    let gainNode = context.createGain();
                    bufferNode.connect(gainNode);
                    gainNode.connect(masterGain);
                    // auto filter
                    // gainNode.connect(filterLow);
                    delay.connectSource(gainNode, partitions[track.id].delay[track.step])
                    let midiPitch;
                    if (partitions[y].mute) {
                        bufferNode.disconnect();
                        gainNode.disconnect();
                    }
                    if (midiOutputSelected == 0) {
                        bufferNode.start();
                    }
                    if (isDecaying && currentPartition == track.id) {
                        //currentDecay = Number(document.getElementById('decay').value);
                        currentDecay = Math.round(adjustedLogslider(Number(document.getElementById('decay').value), 0, 127, 1, 127));
                        partitions[y].decay[track.step] = currentDecay;
                    }
                    currentDecay = currentDecay * (Number(document.getElementById('globalDecay').value) / 100)
                    let x = ((((60 / 1000) * tempo) / 64) / 16) * currentDecay;
                    if (isRandoming) { x = x / 4; }
                    gainNode.gain.setValueAtTime(gainNode.gain.value, context.currentTime);
                    gainNode.gain.linearRampToValueAtTime(0, context.currentTime + x);
                    if (midiOutputSelected == 0) {
                        bufferNode.stop(context.currentTime + x);
                        setTimeout(function () {
                            bufferNode.disconnect();
                            gainNode.disconnect();
                            bufferNode = null;
                            gainNode = null;
                        }, x * 1000);
                    } else {
                        setTimeout(function () {
                            sendMidiNote(note, midiPitch, 127, false);
                        }, x * 1000);
                    }
                    if (isPitching && currentPartition == track.id) {
                        currentPitch = midiToNoteName(Number(document.getElementById('pitch').value));
                        partitions[y].pitch[track.step] = Number(document.getElementById('pitch').value);
                    } else {
                        currentPitch = midiToNoteName(Number(partitions[y].pitch[track.step]));
                    }
                    if (!partitions[y].free) {
                        currentPitch = proxyNote(currentPitch, convertScaleToTonic(scaleList[document.getElementById('scale').value], document.getElementById('tonic').value));
                    }
                    if (midiOutputSelected == 0) {
                        bufferNode.playbackRate.value = note2rate(currentPitch);
                    } else {
                        midiPitch = noteNameToMidi(currentPitch)
                        if (!partitions[y].mute) {
                            sendMidiNote(note, midiPitch, 127, true);
                        }
                    }
                    if (currentPartition == 0) {
                        cells[note - 1].classList.add('currentStep');
                    }
                }
            }
            if (currentPartition != 0) {
                if (track.id == currentPartition && track.step != -1) {
                    cells[track.step].classList.add('currentStep');
                }
            }
            if (trackRandomPlay) {
                track.step = getTrackStep(track);
            }
        }
    });
}

var buttons;

buttons = document.querySelectorAll('#partitions button');
buttons.forEach(button => {
    button.addEventListener('click', (event) => {
        currentPartition = parseInt(event.target.getAttribute('data-number'), 10);
        updateSequencerInterface(currentPartition);
    });
});

function reverseAudioBuffer(buffer, ctx) {
    const reversedBuffer = ctx.createBuffer(
        buffer.numberOfChannels,
        buffer.length,
        buffer.sampleRate
    );
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const originalData = buffer.getChannelData(channel);
        const reversedData = reversedBuffer.getChannelData(channel);
        for (let i = 0; i < originalData.length; i++) {
            reversedData[i] = originalData[originalData.length - 1 - i];
        }
    }
    return reversedBuffer;
}

function getSamplePath(track) {
    return 'kits/' + soundKit + '/' + track + '.wav'
}

async function getStyle() {
    await fetch('kits/' + soundKit + '/style.css')
        .then(response => response.blob())
        .then(blob => {
            let reader = new FileReader();
            reader.onloadend = function () {
                document.getElementById('kitStyle').textContent = reader.result;
            };
            reader.readAsText(blob);
        })
        .catch(error => {
            console.warn(error);
        });
}

var soundBank = {};
async function loadTrack(track) {
    const res = await fetch(getSamplePath(track))
    const arrayBuffer = await res.arrayBuffer()
    const buffer = await context.decodeAudioData(arrayBuffer)
    soundBank[track] = {
        createNode: () => {
            var node = context.createBufferSource()
            node.buffer = buffer
            node.connect(context.destination)
            return node
        }
    }
}

function displayCellMetric(cell_index, metric) {
    let instrument = determineInstrument(metric);
    let cells = document.querySelectorAll(".cell");
    if (cell_index >= cells.length) {
        console.error("Index out of range");
        return;
    }
    let cell = cells[cell_index];
    if (allElementsSame(metric)) {
        cell.firstChild.style.backgroundImage = 'url(kits/' + soundKit + '/' + instrument + '.png)';
        cell.firstChild.style.backgroundSize = '100%';
        cell.firstChild.style.backgroundPosition = 'center';
    } else {
        let positions = ['left top', 'right top', 'left bottom', 'right bottom'];
        let images = metric.map(bit => bit === 0 ? 'url()' : 'url(kits/' + soundKit + '/' + instrument + '.png)');
        cell.firstChild.style.backgroundImage = images.join(', ');
        cell.firstChild.style.backgroundSize = '50%';
        cell.firstChild.style.backgroundPosition = positions.join(', ');
    }
}

function allCharsSame(str) {
    return str.split('').every(char => char === str[0]);
}

function allElementsSame(arr) {
    return arr.every(el => el === arr[0]);
}

function determineInstrument(arr) {
    if (allElementsSame(arr)) {
        return arr[0];
    } else {
        return Math.max(...arr);
    }
}

function arraySame(array1, array2) {
    if (array1.length !== array2.length) {
        return false;
    }
    for (let i = 0; i < array1.length; i++) {
        if (array1[i] !== array2[i]) {
            return false;
        }
    }
    return true;
}

// Notes de référence (A4 à 440 Hz)
function note2rate(note) {
    const noteFrequencyMap = {
        'C0': 16.35, 'C#0': 17.32, 'D0': 18.35, 'D#0': 19.45, 'E0': 20.60, 'F0': 21.83, 'F#0': 23.12, 'G0': 24.50, 'G#0': 25.96, 'A0': 27.50, 'A#0': 29.14, 'B0': 30.87,
        'C1': 32.70, 'C#1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'E1': 41.20, 'F1': 43.65, 'F#1': 46.25, 'G1': 49.00, 'G#1': 51.91, 'A1': 55.00, 'A#1': 58.27, 'B1': 61.74,
        'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
        'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
        'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
        'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.26, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
        'C6': 1046.50, 'C#6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51, 'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98, 'G#6': 1661.22, 'A6': 1760.00, 'A#6': 1864.66, 'B6': 1975.53,
        'C7': 2093.00, 'C#7': 2217.46, 'D7': 2349.32, 'D#7': 2489.02, 'E7': 2637.02, 'F7': 2793.83, 'F#7': 2959.96, 'G7': 3135.96, 'G#7': 3322.44, 'A7': 3520.00, 'A#7': 3729.31, 'B7': 3951.07,
        'C8': 4186.01
    };
    const targetFrequency = noteFrequencyMap[note];
    const originalFrequency = noteFrequencyMap['A4'];
    if (targetFrequency && originalFrequency) {
        const rate = targetFrequency / originalFrequency;
        return rate;
    } else {
        return 0;
    }
}

function generateAllMidiNotes() {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const minOctave = 0;
    const maxOctave = 8;
    const midiNotes = [];
    for (let octave = minOctave; octave <= maxOctave; octave++) {
        for (let noteIndex = 0; noteIndex < noteNames.length; noteIndex++) {
            const noteName = noteNames[noteIndex];
            const noteWithOctave = `${noteName}${octave}`;
            const midiValue = noteIndex + (octave * 12) + 12;

            midiNotes.push({ name: noteWithOctave, midi: midiValue });
        }
    }
    return midiNotes;
}
const allMidiNotes = generateAllMidiNotes();

const scaleList = {
    'Chromatic': ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    'Ionian': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    'Dorian': ['C', 'D', 'D#', 'F', 'G', 'A', 'A#'],
    'Phrygian': ['C', 'C#', 'D#', 'F', 'G', 'G#', 'A#'],
    'Lydian': ['C', 'D', 'E', 'F#', 'G', 'A', 'B'],
    'Mixolydian': ['C', 'D', 'E', 'F', 'G', 'A', 'A#'],
    'Aeolian': ['C', 'D', 'D#', 'F', 'G', 'G#', 'A#'],
    'Locrian': ['C', 'C#', 'D#', 'F', 'F#', 'G#', 'A#'],
    'Major Blues': ['C', 'D', 'D#', 'E', 'G', 'A'],
    'Minor Blues': ['C', 'D#', 'F', 'F#', 'G', 'A#'],
    'Diminish': ['C', 'D', 'D#', 'F#', 'G#', 'A'],
    'Combination Diminish': ['C', 'D#', 'E', 'F#', 'G', 'A', 'A#'],
    'Major Pentatonic': ['C', 'D', 'E', 'G', 'A'],
    'Minor Pentatonic': ['C', 'D#', 'F', 'G', 'A#'],
    'Raga Bhairav': ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'],
    'Raga Gamanasrama': ['C', 'D', 'D#', 'F', 'G', 'G#', 'Bb'],
    'Raga Todi': ['C', 'C#', 'D#', 'F', 'G', 'A', 'Bb'],
    'Spanish Scale': ['C', 'C#', 'D#', 'E', 'F', 'G', 'G#', 'A#'],
    'Gypsy Scale': ['C', 'D', 'D#', 'F#', 'G', 'A', 'A#'],
    'Arabian Scale': ['C', 'D', 'D#', 'F', 'G', 'A', 'A#'],
    'Egyptian Scale': ['C', 'D', 'F', 'G', 'A', 'A#'],
    'Hawaiian Scale': ['C', 'D', 'E', 'G', 'A'],
    'Bali Island Pelog': ['C', 'C#', 'D', 'F', 'G'],
    'Japanese Miyakobushi': ['C', 'D', 'E', 'G', 'A'],
    'Ryukyu Scale': ['C', 'D', 'E', 'G', 'A', 'B'],
    'Wholetone': ['C', 'D', 'E', 'F#', 'G#', 'A#'],
    'minor 3rd Interval': ['C', 'D#'],
    '3rd Interval': ['C', 'E'],
    '4th Interval': ['C', 'F'],
    '5th Interval': ['C', 'G'],
    'Octave Interval': ['C'],
};

const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function transposeNote(note, semitones) {
    const index = noteOrder.indexOf(note);
    const transposedIndex = (index + semitones) % 12;
    return noteOrder[transposedIndex];
}

function getNoteFromScale(noteValue, tonic, scale) {
    scale = convertScaleToTonic(scale, tonic);
    const tonicIndex = scale.indexOf(tonic);
    let noteIndex = (tonicIndex + noteValue) % scale.length;
    if (noteIndex < 0) { noteIndex += scale.length; }
    const constrainedNote = scale[noteIndex];
    const octave = Math.floor((tonicIndex + noteValue) / scale.length);
    return '' + constrainedNote + octave;
}

function noteNameToMidi(noteName) {
    const note = noteName.slice(0, -1);
    const octave = parseInt(noteName.slice(-1), 10);
    return noteOrder.indexOf(note) + (octave + 1) * 12;
}

function midiToNoteName(midi) {
    const note = noteOrder[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return note + octave;
}

function convertScaleToTonic(scale, tonic) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const tonicIndex = notes.indexOf(tonic);
    const adjustedScale = scale.map(note => {
        const noteIndex = notes.indexOf(note);
        return notes[(noteIndex + tonicIndex) % notes.length];
    });
    return adjustedScale;
}

function proxyNote(noteValue, convertedScale) {
    let noteMidi = noteNameToMidi(noteValue);
    if (isRandoming) {
        noteMidi = Math.floor(Math.random() * 128) // full random
        // noteMidi = Math.floor(Math.random() * 25) + (noteMidi - 12); // -1/+1 octvae random
    }
    if (octaveUp) { noteMidi = noteMidi + 12 }
    if (octaveDown) { noteMidi = noteMidi - 12 }
    let closestNote = null;
    let smallestDistance = Infinity;
    for (let note of convertedScale) {
        for (let octave = -1; octave <= 9; octave++) {
            const scaleNote = note + octave;
            const scaleNoteMidi = noteNameToMidi(scaleNote);

            const distance = Math.abs(scaleNoteMidi - noteMidi);
            if (distance < smallestDistance) {
                smallestDistance = distance;
                closestNote = scaleNoteMidi;
            }
        }
    }
    return midiToNoteName(closestNote);
}

// Pitch control
let isTempoing = false;
let intervalTempo = null;
let isPitching = false;
let isReversing = false;
let isDelaying = false;
let isDelayingTrack = false;
let intervalPitch = null;
let intervalDelayWet = null;
let isDecaying = false;
let intervalDecay = null;
let octaveDown = false;
let octaveUp = false;
let isRandoming = false;

document.getElementById('reverse').addEventListener('pointerdown', function () {
    if (shiftPressed) { return }
    let x = Number(!this.checked);
    partitions[currentPartition].reverse = [x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x];
});

document.getElementById('delay').addEventListener('pointerdown', function () {
    if (shiftPressed) { return }
    let x = Number(!this.checked);
    partitions[currentPartition].delay = [x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x];
});

document.getElementById('free').addEventListener('pointerdown', function () {
    partitions[currentPartition].free = Number(this.checked);
});

document.getElementById('tempo').addEventListener('pointerdown', function () {
    isTempoing = true;
});
document.getElementById('tempo').addEventListener('pointermove', function () {
    setTempo();
});

document.getElementById('tempo').addEventListener('pointerup', function () {
    setTempo();
});

document.getElementById('pitch').addEventListener('pointerdown', function () {
    isPitching = true;
});

document.getElementById('delayWet').addEventListener('pointerdown', function () {
    isDelaying = true;
    intervalDelayWet = setInterval(function () {
        delayWet = Number(document.getElementById('delayWet').value)
        if (delay != undefined) { delay.setWet(delayWet) }
        partitions[0].delay = delayWet;
    }, 10);
});

document.getElementById('delayWet').addEventListener('pointermove', function () {
    if (intervalDelayWet) {
        delayWet = Number(document.getElementById('delayWet').value)
        if (delay != undefined) { delay.setWet(delayWet) }
    }
});

document.addEventListener('pointerup', function () {
    isPitching = false;
    isReversing = false;
    isDelayingTrack = false;
    if (intervalPitch) {
        clearInterval(intervalPitch);
        intervalPitch = null;
    }
    isDelaying = false;
    if (intervalDelayWet) {
        clearInterval(intervalDelayWet);
        intervalDelayWet = null;
    }
    isDecaying = false;
    if (intervalDecay) {
        clearInterval(intervalDecay);
        intervalDecay = null;
    }
    isTempoing = false;
    if (intervalTempo) {
        clearInterval(intervalTempo);
        intervalTempo = null;
    }
});

document.getElementById('decay').addEventListener('pointerdown', function () {
    isDecaying = true;
});

document.getElementById('signature').onwheel = function (event) {
    event.preventDefault();
    const { deltaY: y } = event;
    const speedFactors = [1, 2, 4, 8, 16];
    let currentSpeedFactor = partitions[currentPartition].speedFactor;
    let currentIndex = speedFactors.indexOf(currentSpeedFactor);
    if (y < 0) {
        if (currentIndex < speedFactors.length - 1) {
            partitions[currentPartition].speedFactor = speedFactors[currentIndex + 1];
            document.getElementById('trackSpeed').innerText = partitions[currentPartition].speedFactor;
        }
    } else {
        if (currentIndex > 0) {
            partitions[currentPartition].speedFactor = speedFactors[currentIndex - 1];
            document.getElementById('trackSpeed').innerText = partitions[currentPartition].speedFactor;
        }
    }
}

document.getElementById('direction').onwheel = function (event) {
    event.preventDefault();
    const { deltaY: y } = event;
    const directionFactors = ['backward', 'forward', 'roundtrip', 'random'];
    let currentDirection = partitions[currentPartition].direction;
    let currentIndex = directionFactors.indexOf(currentDirection);
    if (y < 0) {
        if (currentIndex < directionFactors.length - 1) {
            partitions[currentPartition].direction = directionFactors[currentIndex + 1];
            document.getElementById('dir').src = 'img/' + partitions[currentPartition].direction + '.png';
        }
    } else {
        if (currentIndex > 0) {
            partitions[currentPartition].direction = directionFactors[currentIndex - 1];
            document.getElementById('dir').src = 'img/' + partitions[currentPartition].direction + '.png';
        }
    }
}

document.getElementById('reset_pitch').addEventListener('pointerdown', function () {
    for (let i = 0; i < partitions[currentPartition].pitch.length; i++) {
        partitions[currentPartition].pitch[i] = 69;
    }
    document.getElementById('pitch').value = '69'
});

document.getElementById('reset_decay').addEventListener('pointerdown', function () {
    for (let i = 0; i < partitions[currentPartition].decay.length; i++) {
        partitions[currentPartition].decay[i] = 128;
    }
    document.getElementById('decay').value = '127'
});

function isSolo() {
    var result = 0;
    for (let i = 1; i < partitions.length; i++) {
        if (partitions[i].mute == false) {
            result = result + 1;
        }
    }
    if (result == 1) {
        return true;
    } else {
        return false;
    }
}

class Delay {
    constructor(context, bpm, division, wet) {
        this.context = context;
        this.bpm = bpm;
        this.division = division;
        this.wet = wet;
        this.delayNode = this.context.createDelay();
        this.feedbackGainNode = this.context.createGain();
        this.dryGainNode = this.context.createGain();
        this.wetGainNode = this.context.createGain();
        this.sources = [];
        this.delayNode.connect(this.feedbackGainNode);
        this.feedbackGainNode.connect(this.delayNode);
        this.delayNode.connect(this.wetGainNode);
        this.wetGainNode.connect(masterGain);
        //this.dryGainNode.connect(this.context.destination);
        this.updateDelayTime();
        this.feedbackGainNode.gain.value = 0.5;
        this.updateWetDry();
    }

    updateDelayTime() {
        const quarterNoteTime = 60 / this.bpm;
        const delayTime = quarterNoteTime * (this.division / 16);
        this.delayNode.delayTime.value = Math.min(delayTime, 1); // [0,1] fix
    }

    updateWetDry() {
        this.wetGainNode.gain.value = this.wet;
        this.dryGainNode.gain.value = 1 - this.wet;
    }

    setBPM(bpm) {
        this.bpm = bpm;
        this.updateDelayTime();
    }

    setDivision(division) {
        this.division = division;
        this.updateDelayTime();
    }

    setWet(wet) {
        this.wet = wet;
        this.updateWetDry();
    }

    connectSource(source, gain = 1) {
        const sourceGainNode = this.context.createGain();
        sourceGainNode.gain.value = gain;
        source.connect(sourceGainNode);
        sourceGainNode.connect(this.delayNode);
        this.sources.push({ source, sourceGainNode });
    }

    disconnectSource() {
        this.sources.forEach(({ sourceGainNode }) => {
            sourceGainNode.disconnect();
        });
        this.sources = [];
    }

    destroy() {
        this.disconnectSource();
        this.delayNode.disconnect();
        this.feedbackGainNode.disconnect();
        this.dryGainNode.disconnect();
        this.wetGainNode.disconnect();
        this.delayNode = null;
        this.feedbackGainNode = null;
        this.dryGainNode = null;
        this.wetGainNode = null;
        this.context = null;
    }
}

function clonePartition(partitions) {
    return partitions.map((partition, index) => {
        // no .step
        const { step, ...rest } = partition;
        // retro-compatibility
        let reverse = rest.reverse;
        if (index > 0) {
            if (reverse === false || reverse === 0) {
                reverse = Array(16).fill(0);
            } else if (reverse === true || reverse === 1) {
                reverse = Array(16).fill(1);
            }
        }
        let delay = rest.delay;
        if (index > 0) {
            if (delay === false || delay === 0) {
                delay = Array(16).fill(0);
            } else if (delay === true || delay === 1) {
                delay = Array(16).fill(1);
            }
        }
        return {
            ...rest,
            beat: Array.isArray(rest.beat) ? [...rest.beat] : rest.beat,
            pitch: Array.isArray(rest.pitch) ? [...rest.pitch] : rest.pitch,
            decay: Array.isArray(rest.decay) ? [...rest.decay] : rest.decay,
            songMode: Array.isArray(rest.songMode) ? [...rest.songMode] : rest.songMode,
            tonic: Array.isArray(rest.tonic) ? [...rest.tonic] : rest.tonic,
            scale: Array.isArray(rest.scale) ? [...rest.scale] : rest.scale,
            advanced: Array.isArray(rest.advanced) ? [...rest.advanced] : rest.advanced,
            reverse,
            delay,
        };
    });
}

function loadPartition(partition) {
    var temp = []
    for (let i = 1; i < partitions.length; i++) {
        temp[i] = partitions[i].step;
    }
    partitions = clonePartition(partition)
    for (let i = 1; i < partitions.length; i++) {
        partitions[i].step = temp[i];
    }
    if (!isPlaying) {
        document.getElementById("tempo").value = partition[0].bpm;
        setTempo();
        document.getElementById("swing").value = partition[0].swing;
        swing = partition[0].swing;
    }
    document.getElementById("globalDecay").value = partition[0].decay;
    document.getElementById("delayWet").value = partition[0].delay;
    delayWet = partition[0].delay;
    if (delay != undefined) {
        delay.setWet(delayWet);
    }
    partitions[0].tonic = partition[0].tonic || 'A';
    document.getElementById('tonic').value = partitions[0].tonic;
    partitions[0].scale = partition[0].scale || 'Chromatic';
    document.getElementById('scale').value = partitions[0].scale;
    updateSequencerInterface();
}

var snap;

document.addEventListener("keydown", (event) => {
    handleKeyPress(event.key);
});
document.addEventListener("keyup", (event) => {
    handleKeyUp(event.key);
});

function convertBeat(array, replacement) {
    if (typeof array !== 'object' || array === null) {
        return array !== 0 ? replacement : 0;
    }
    return array.map(item =>
        Array.isArray(item)
            ? convertBeat(item, replacement)
            : (item !== 0 ? replacement : 0)
    );
}

function handleKeyPress(key) {
    if (document.getElementById('songEditor').style.display != 'block') {
        if (key === " ") {
            if (!isPlaying) {
                play()
            } else {
                stop()
            }
        }
        if (key === "s") {
            snap = clonePartition(partitions)
        }
        if (key === "l") {
            if (snap != undefined) {
                loadPartition(snap)
                lastSongPos = -1;
            }
        }
        if (key === "c" && cellHover != -1) {
            if (currentPartition != 0) {
                cellClipBoard = {
                    'pitch': partitions[currentPartition].pitch[cellHover],
                    'beat': partitions[currentPartition].beat[cellHover],
                    'decay': partitions[currentPartition].decay[cellHover],
                    'reverse': partitions[currentPartition].reverse[cellHover],
                }
            } else {
                patternClipBoard = structuredClone(partitions[cellHover + 1]);
            }
        }
        if (key === "v" && cellHover != -1) {
            if (currentPartition != 0) {
                partitions[currentPartition].pitch[cellHover] = cellClipBoard.pitch;
                cellClipBoard.beat = convertBeat(cellClipBoard.beat, currentPartition);
                partitions[currentPartition].beat[cellHover] = cellClipBoard.beat;
                partitions[currentPartition].decay[cellHover] = cellClipBoard.decay;
                partitions[currentPartition].reverse[cellHover] = cellClipBoard.reverse;
                updateSequencerInterface(currentPartition);
            } else {
                patternClipBoard.id = cellHover + 1;
                patternClipBoard.beat = convertBeat(patternClipBoard.beat, cellHover + 1);
                partitions[cellHover + 1] = structuredClone(patternClipBoard);
                updateSequencerInterface();
            }
        }
        if (key === "x" && cellHover != -1) {
            if (currentPartition != 0) {
                cellClipBoard = {
                    'pitch': partitions[currentPartition].pitch[cellHover],
                    'beat': partitions[currentPartition].beat[cellHover],
                    'decay': partitions[currentPartition].decay[cellHover],
                    'reverse': partitions[currentPartition].reverse[cellHover],
                }
                partitions[currentPartition].pitch[cellHover] = 69;
                partitions[currentPartition].beat[cellHover] = 0;
                partitions[currentPartition].decay[cellHover] = 128;
                updateSequencerInterface(currentPartition);
            } else {
                patternClipBoard = structuredClone(partitions[cellHover + 1]);
                partitions[cellHover + 1].beat = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                partitions[cellHover + 1].pitch = [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69];
                partitions[cellHover + 1].speedFactor = 1;
                partitions[cellHover + 1].step = 15;
                partitions[cellHover + 1].decay = [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128];
                partitions[cellHover + 1].mute = false;
                partitions[cellHover + 1].mod = 16;
                partitions[cellHover + 1].direction = 'forward';
                partitions[cellHover + 1].delay = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                partitions[cellHover + 1].reverse = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                updateSequencerInterface();
            }
        }
        if (key === "b" && currentPartition != 0) {
            document.getElementById('pitch').value = '69'
            document.getElementById('decay').value = '127'
            partitions[currentPartition].beat = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            partitions[currentPartition].pitch = [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69];
            partitions[currentPartition].speedFactor = 1;
            partitions[currentPartition].step = 15;
            partitions[currentPartition].decay = [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128];
            partitions[currentPartition].mute = false;
            partitions[currentPartition].mod = 16;
            partitions[currentPartition].direction = 'forward';
            partitions[currentPartition].delay = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            partitions[currentPartition].reverse = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            updateSequencerInterface(currentPartition);
            cells.forEach((cell, index) => { cell.classList.add('currentStep'); });
            setTimeout(() => { if (!isPlaying) { cells.forEach((cell, index) => { cell.classList.remove('currentStep'); }); } }, 250);
        }
        if (key === "Escape") {
            playSong.checked = !playSong.checked;
        }
        if (key === "ArrowLeft" && currentPartition != 0) {
            currentPartition = currentPartition - 1;
            if (currentPartition < 1) {
                currentPartition = 16;
            }
            updateSequencerInterface(currentPartition);
        }
        if (key === "ArrowRight" && currentPartition != 0) {
            currentPartition = currentPartition + 1;
            if (currentPartition > 16) {
                currentPartition = 1;
            }
            updateSequencerInterface(currentPartition);
        }
        if (key === "o") {
            octaveDown = true;
        }
        if (key === "p") {
            octaveUp = true;
        }
        if (key === "r") {
            isRandoming = true;
        }
        if (key === "Shift") {
            shiftPressed = true;
        }
    }
}

function handleKeyUp(key) {
    if (key === "o") {
        octaveDown = false;
    }
    if (key === "p") {
        octaveUp = false;
    }
    if (key === "r") {
        isRandoming = false;
    }
    if (key === "Shift") {
        shiftPressed = false;
    }
}

initMetricStep();

document.addEventListener('pointerdown', function (event) {
    if (event.button == 0) {
        leftClickDown = true;
    }
    if (event.button == 2) {
        rightClickDown = true;
    }
});

document.addEventListener('pointerup', function (event) {
    if (event.button == 0) {
        leftClickDown = false;
    }
    if (event.button == 2) {
        rightClickDown = false;
    }
});

document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

const blockchildren = document.getElementById('blocks');

function setCurrentBlock(index) {
    const children = document.querySelectorAll('#blocks > div');
    children.forEach(child => child.classList.remove('currentBlock'));
    if (index >= 0 && index < children.length) {
        children[index].classList.add('currentBlock');
    }
}

blockchildren.addEventListener('click', function (event) {
    if (event.target !== blockchildren) {
        let block = parseInt((event.target.textContent), 16);
        if (blocks[block] != undefined) {
            loadPartition(blocks[block]);
            if (!isPlaying) {
                document.getElementById("tempo").value = partitions[0].bpm;
                document.getElementById('swing').value = partitions[0].swing;
                play();
            }
            playSong.checked = false;
        }
        setCurrentBlock(block);
    }
});

blockchildren.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    if (event.target !== blockchildren) {
        swing = Number(document.getElementById('swing').value);
        let block = parseInt((event.target.textContent), 16);
        blocks[block] = clonePartition(partitions);
        blocks[block][0].swing = swing;
        setCurrentBlock(block);
    }
});

const songEditor = document.getElementById('songEditor');

const hexPattern = /[0-9A-Fa-f]{2}/g;
function convertToDecimalArray(hexString) {
    const validHexValues = hexString.match(hexPattern);
    return validHexValues ? validHexValues.map(hex => parseInt(hex, 16)) : [];
}

function songEditorToArray() {
    const hexContent = songEditor.textContent;
    const decimalArray = convertToDecimalArray(hexContent);
    song = decimalArray;
    const formattedContent = song.map(value => value.toString(16).padStart(2, '0')).join(' ');
    songEditor.textContent = formattedContent;
}

function arrayToSongEditor() {
    let content = "";
    for (let i = 0; i < song.length; i++) {
        content = content + decimalToHex(song[i]) + " ";
    }
    songEditor.textContent = content;
}

songEditor.addEventListener('blur', function () {
    songEditorToArray();
    updateSongOnChange();
    document.getElementById('songFeedback').style.display = 'block';
    document.getElementById('songEditor').style.display = 'none';
});

songEditorToArray();

function updateGlobalDecay() {
    partitions[0].decay = Number(document.getElementById('globalDecay').value);
}
document.getElementById('globalDecay').addEventListener('input', updateGlobalDecay);

function decimalToHex(decimal) {
    let hex = decimal.toString(16).toUpperCase();
    return hex.padStart(2, '0');
}

function updateSongOnChange() {
    let content = ""
    for (let i = 0; i < song.length; i++) {
        content = content + '<span>' + decimalToHex(song[i]) + '</span> '
    }
    document.getElementById('songFeedback').innerHTML = content;
}
updateSongOnChange();

function displaySongFeedBackCurrentBlock(x) {
    const songFeedbackDiv = document.getElementById('songFeedback');
    const spans = songFeedbackDiv.getElementsByTagName('span');
    for (let i = 0; i < spans.length; i++) {
        spans[i].classList.remove('currentBlock');
    }
    if (x >= 0 && x < spans.length) {
        spans[x].classList.add('currentBlock');
    }
}

document.getElementById('songFeedback').addEventListener('click', function () {
    document.getElementById('songFeedback').style.display = 'none';
    document.getElementById('songEditor').style.display = 'block';
    document.getElementById('songEditor').contentEditable = 'true'
    document.getElementById('songEditor').focus();
});

function addBlock1() {
    const blockx = document.getElementById('blocks');
    const blockChildren = blockx.getElementsByTagName('div');
    const newIndex = blockChildren.length;
    const newHex = decimalToHex(newIndex);
    const newDiv = document.createElement('div');
    newDiv.textContent = newHex;
    blockx.appendChild(newDiv);
    blocks[newIndex] = clonePartition(partitions);
}

document.getElementById('addBlock1').addEventListener('click', addBlock1);

function exportSong() {
    partitions[0].songMode = playSong.checked;
    partitions[0].kit = soundKit;
    let songExport = {};
    songExport.partitions = clonePartition(partitions);
    songExport.blocks = [];
    for (let i = 0; i < blocks.length; i++) {
        songExport.blocks[i] = clonePartition(blocks[i]);
    }
    songExport.song = []
    for (let i = 0; i < song.length; i++) {
        songExport.song[i] = song[i];
    }
    return JSON.stringify(songExport)
}

function updateBlocks() {
    const blockx = document.getElementById('blocks');
    blockx.innerHTML = '';
    for (let i = 0; i < blocks.length; i++) {
        let newDiv = document.createElement('div');
        newDiv.textContent = decimalToHex(i);
        blockx.appendChild(newDiv);
    }
}

async function importSong(songImport, title = "Untitled") {
    songTile = title;
    if (!songImport.partitions[0].kit) {
        songImport.partitions[0].kit = "jankenpopp";
    }
    if (songImport.partitions[0].kit != soundKit) {
        soundKit = songImport.partitions[0].kit;
        await initContext();
        await loadSamples();
    }
    partitions = clonePartition(songImport.partitions);
    blocks = []
    for (let i = 0; i < songImport.blocks.length; i++) {
        blocks[i] = clonePartition(songImport.blocks[i]);
    }
    if (blocks.length > 0) {
        document.getElementById('blocks').classList.add('v');
        document.getElementById('ab').classList.add('v');
        document.getElementById('blockInterface').setAttribute('aria-pressed', 'true');
    } else {
        document.getElementById('blocks').classList.remove('v');
        document.getElementById('ab').classList.remove('v');
        document.getElementById('blockInterface').setAttribute('aria-pressed', 'false');
    }
    if (songImport.partitions[0].songMode) {
        document.getElementById('song').classList.add('v');
        document.getElementById('songInterface').setAttribute('aria-pressed', 'true');
    } else {
        document.getElementById('song').classList.remove('v');
        document.getElementById('songInterface').setAttribute('aria-pressed', 'false');
    }
    song = [];
    for (let i = 0; i < songImport.song.length; i++) {
        song[i] = songImport.song[i];
    }
    updateSequencerInterface();
    updateBlocks();
    arrayToSongEditor();
    updateSongOnChange();
    if (!isPlaying) {
        document.getElementById("tempo").value = partitions[0].bpm;
        document.getElementById('swing').value = partitions[0].swing;
    }
    playSong.checked = partitions[0].songMode;
    lastSongPos = -1;
    advancedEl.checked = partitions[0].advanced;
    updateAdvancedInterface();
    document.getElementById('tonic').value = partitions[0].tonic;
    document.getElementById('scale').value = partitions[0].scale;
    octaveDown = false;
    octaveUp = false;
    isRandoming = false;
}

function downloadSong() {
    let content = exportSong();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const filename = `${songTile}-${year}-${month}-${day}-${hours}h${minutes}-${seconds}s.nimo`;
    let blob = new Blob([content], { type: 'text/plain' });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.getElementById('saveSong').onclick = function () {
    downloadSong()
};

document.getElementById('loadSong').onclick = function () {
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.nimo,.txt,.json';
    input.addEventListener('change', function (event) {
        let file = event.target.files[0];
        if (file) {
            let reader = new FileReader();
            reader.onload = function (e) {
                let content = e.target.result;
                importSong(JSON.parse(content));
            };
            reader.readAsText(file);
        }
    });
    input.click();
};

const tonicEl = document.getElementById('tonic')
const scaleEl = document.getElementById('scale')
function partitionHarmonyUpdate() {
    partitions[0].tonic = tonicEl.value || 'A';
    partitions[0].scale = scaleEl.value || 'Chromatic';
}

tonicEl.oninput = partitionHarmonyUpdate
scaleEl.oninput = partitionHarmonyUpdate

function updateAdvancedInterface() {
    document.querySelectorAll('.advanced').forEach(el => {
        el.hidden = !advancedEl.checked;
        partitions[0].advanced = advancedEl.checked;
    });
}

updateAdvancedInterface();

advancedEl.addEventListener('change', function () {
    updateAdvancedInterface();
});

// Midi

let midiAccess = null;
let midiOutput = null;
let midiChosen = false;
let midiOutputSelected = 0;
const midiSelect = document.getElementById("midiouts");

function handleMidiChange(event) {
    stopAllMidiNotes();
    const selectedValue = event.target.value;
    const outputs = Array.from(midiAccess.outputs.values());
    midiOutput = outputs.find(output => output.id === selectedValue) || null;
    if (midiOutput) {
        const selectedIndex = outputs.findIndex(output => output.id === selectedValue);
        midiOutputSelected = outputs.findIndex(output => output.id === selectedValue) + 1;
    } else {
        midiOutputSelected = 0;
    }
    midiSelect.classList.toggle('v');
    midiAccessButton.setAttribute('aria-pressed', !(midiAccessButton.getAttribute('aria-pressed') === 'true'));
}

function updateMidiOutputs() {
    midiSelect.removeEventListener("change", handleMidiChange);
    midiSelect.innerHTML = '<option>No Midi</option>';
    const outputs = Array.from(midiAccess.outputs.values());
    outputs.forEach((output) => {
        const option = document.createElement("option");
        option.value = output.id;
        option.textContent = output.name;
        midiSelect.appendChild(option);
    });
    midiSelect.addEventListener("change", handleMidiChange);
    midiChosen = true;
}

function requestMidiAccess() {
    midiSelect.classList.toggle('v');
    midiAccessButton.setAttribute('aria-pressed', !(midiAccessButton.getAttribute('aria-pressed') === 'true'));
    navigator.requestMIDIAccess({ sysex: true }).then((midi) => {
        midiAccess = midi;
        updateMidiOutputs();
        midiAccess.onstatechange = updateMidiOutputs;
    }).catch((err) => console.error("MIDI Error :", err));
}
const midiAccessButton = document.getElementById("midiAccessButton");
midiAccessButton.addEventListener("click", requestMidiAccess);

document.getElementById('harmonyInterface').addEventListener("click", function () {
    document.getElementById('tonic').classList.toggle('v');
    document.getElementById('scale').classList.toggle('v');
    document.getElementById('tcptch').classList.toggle('v');
    document.getElementById('harmonyInterface').setAttribute('aria-pressed', !(document.getElementById('harmonyInterface').getAttribute('aria-pressed') === 'true'));
    const tcptch = document.getElementById("tcptch");
    if (currentPartition != 0) {
        if (document.getElementById("harmonyInterface").getAttribute("aria-pressed") === "true") {
            tcptch.style.setProperty("display", "initial", "important");
        } else {
            tcptch.style.setProperty("display", "none", "important");
        }
    } else {
        tcptch.style.setProperty("display", "none", "important");
    }
});

document.getElementById('blockInterface').addEventListener("click", function (e) {
    document.getElementById('blocks').classList.toggle('v');
    document.getElementById('ab').classList.toggle('v');
    document.getElementById('blockInterface').setAttribute('aria-pressed', !(document.getElementById('blockInterface').getAttribute('aria-pressed') === 'true'));
});

document.getElementById('songInterface').addEventListener("click", function (e) {
    document.getElementById('song').classList.toggle('v');
    document.getElementById('songInterface').setAttribute('aria-pressed', !(document.getElementById('songInterface').getAttribute('aria-pressed') === 'true'));
});

const noteToMidi = (note) => {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    let octave = 4;
    let pitchName = note;
    if (!isNaN(note.slice(-1))) {
        octave = parseInt(note.slice(-1), 10);
        pitchName = note.slice(0, -1);
    }
    const pitch = notes.indexOf(pitchName);
    if (pitch === -1) return 60;
    return 12 * (octave + 1) + pitch;
};

function sendMidiNote(channel, note, velocity, on) {
    if (midiOutput) {
        if (isNaN(note) || note < 0 || note > 127) {
            return;
        }
        channel = parseInt(channel, 10);
        const status = (on ? 0x90 : 0x80) + (channel - 1);
        midiOutput.send([status, note, velocity]);
    }
}

function stopAllMidiNotes() {
    if (midiOutput) {
        for (let channel = 1; channel <= 16; channel++) {
            midiOutput.send([0xB0 + (channel - 1), 123, 0]);
        }
    }
}

import { inIframe } from "../../../../../../42/api/env/realm/inIframe.js"
import { App } from "../../../../../../42/api/os/App.js"
import { folderPicker } from "../../../../../../42/ui/desktop/explorer.js";
import { getBasename } from "../../../../../../42/lib/syntax/path/getBasename.js";

let app

if (inIframe) {
    app = new App()

    app
        .on("decode", async (fileAgent) => {
            const json = await fileAgent.getJSON()
            importSong(
                json,
                fileAgent.path
                    .split("/")
                    .pop()
                    .replace(/\.[^./]+$/, ""),
            )
        })
        .on("encode", async () => exportSong())

    document.querySelector("#saveSong").onclick = () => {
        app.saveFileAs()
    }

    document.querySelector("#loadSong").onclick = () => {
        app.openFile()
    }

}

document.querySelector("#loadKit").onclick = async () => {
    const res = await folderPicker(
        new URL("../kits/", import.meta.url).pathname,
        {
            returnPaths: true,
            id: app?.manifest.command,
        }
    )
    if (res.ok) {
        soundKit = getBasename(res.directory);
        await initContext();
        await loadSamples();
        updateSequencerInterface(currentPartition);
    }
}

document.body.style.visibility = "initial";