# Nimoloop
## Version 3.0

A cute sound tracker by Jankenpopp (2024)


**Introduction**  


Nimoloop is a sample-based sound tracker written in javascript for the web, heavily inspired by Nanoloop and LSDJ softwares, Korg and Teenage Engineering musical instruments and everything else I like about various music softwares I've been using for over 25 years. 

It has been designed to write electronic music quickly and simply using a mouse and keyboard, with a strong emphasis on live performance. The use of a wheel mouse is strongly recommended.

---

# Basic Controls 

The main screen is called ‘Song editor’, while the instrument screen is called ‘Nimo editor’. When using Nimoloop, you will frequently switch from one view to the other.

## Song Editor

This is the general view of your song, with each Nimo portrait representing an audio track, for a total of 16 tracks.

**Song Interaction: **  
- **Play Button or SPACE Key: ** Start/Stop the song.
- **Tempo slider: ** Change song tempo.
- **Decay slider: ** Global song decay.
- **Echo slider: ** Global delay wet, you must enable the echo parameter in Nimo Editor to ear it (see further).
- **Load Button: ** Load a song.
- **Save Button: ** Load current song.
- **SU checkbox: ** Enable/Disable Advanced Interface (see further).
- **Key S: ** Snapshot the current song state.
- **Key L: ** Load last state Snapshot (great for drops).
- **Key O: ** On press, apply a global one-octave pitchdown.
- **Key P: ** On press, apply a global one-octave pitchup.
- **Key R: ** On press, apply a global random pitch effect.

**Nimo Interaction: **  

- **Left click: ** Move to Nimo editor.  
- **Right click: ** Mute/Unmute Nimo.  
- **Wheel click ** Solo/Unsolo Nimo.
- **Key C: ** Copy Nimo 
- **Key V: ** Paste Nimo 
- **Key X: ** Cut Nimo 

## Nimo Editor

The ‘Nimo Editor’ shows you the track's partition, which is empty by default.    


**Nimo Partition **  

- **Left click on background: ** Go back to Song Editor.  
- **Left click: ** Add a note.  
- **Right click: ** Remove a note.  
- **Wheel click: ** Change partition Modulo cycle.
- **Key B: ** Bomb the track (delete track notes).

**Mouseover Note **  

- **Key C: ** Copy Note 
- **Key V: ** Paste Note 
- **Key X: ** Cut Note 
- **Wheel-up/Wheel-down: ** Change note's ‘metric’, allows you to add silences and variations to your partition.

**Track controls **  

- **Pitch Slider: ** Change notes pitch (looper mode). Changes made by hand this way will be looped within the score, like the PO-10 series.
- **Decay Slider: ** Change notes decay (looper mode). Changes made by hand this way will be looped within the score.
- **Echo checkbox: ** Enable/disable the rooting of current Nimo into the Global Delay Channel.
- **Shift + Echo Checkbox: ** Change notes echo mode (looper mode). Changes made by hand this way will be looped within the score.

**Extra Keys **  

- **Left & Right keys: ** switch to the next or previous nimo.

---

# Advanced Controls 

You must tick the ‘SU’ checkbox to have access to these controls.


## Harmony Controls  

Inspired by Korg's first Kaossilator, these controls let you tune your song to the tonic and harmonic scale of your choice.   

- **Tonic selector: ** Choose the current fundamental note of your song (default: A).
- **Scale selector: ** Choose the current scale for your song (default: Chromatic, which is like no scale).

## Swing Slider

This slider lets you add or remove groove to your song. In music theory, the principle of swing/groove is to delay the weak beat of your bar in time, which will produce a swaying effect like you might find in blues or jazz. For aesthetic and practical reasons, you can only change this slider when the song is stopped.

## Block Editor  

The ‘Block Editor’ allow you to save and load current song states. You can use it to radically change the state of your song, which can be very useful in live context for making drops. Recorded blocks will also be used directly in ‘Song mode’ to write more elaborate structures (see further). For greater visual comfort, the blocks are numbered in hexadecimal.

- **[+] button: ** Create a block and save current song state inside (default: 00). 
- **Left click on a block: ** Load clocked block to current song state.
- **Right click on a block: ** Save current song state to clicked block.


## Song Editor  

Inspired by the LSDJ software, the ‘Song Editor’ allow you to sequence your saved blocks into a structured song. You need to tick the ‘Song Editor’ checkbox to activate this mode. The default value (00 00 00 00) will play block 00 4 times.

- **Song Mode Text: ** Double click it to edit your song structure. You have to enter block's numbers by hand with your keyboard (in hexadecimal). Once done, click anywhere else to go back to Nimoloop. Text formatting is automatic here.

## Nimo Editor

The advance mode adds extra functionalities to your Nimos tracks, allowing you to have more control over the current track's sequencer behaviour.

- **Reverse Checkbox: ** tick it to play the current Nimo sample in reverse. 
- **Shift + Reverse Checkbox: ** Change notes reverse mode (looper mode). Changes made by hand this way will be looped within the score.
- **Free Checkbox: ** tick it to ignore the global harmony for the current Nimo. Usefull for preserving the pitch of percussions, for example.  
- **Step x 1: ** Mouse wheel on this parameter will change the track's sequencer beat value. This lets you multiply or divide the rhythmic beat of the current track.
- **Direction >>: ** Mouse wheel on this parameter will change the way the direction behaviour of current track's sequencer. There are four reading modes: backwards, forwards, back&forth and random. 

## Midi-Out

If you specify a MIDI output device then Nimoloop will send MIDI notes instead of playing samples, where each Nimo represents a MIDI track from 1 to 16. Nimoloop will also send a MIDI clock to the specified output device.

---

## Thanks

- Sébastien Piquemal for writing WAAClock.js, a javascript clock on which Nimoloop 3.0 is built.
- Zombectro (Nanoloop Sempai) & Sam-Sam Microcontact (IDM Sempai) for beta testing and feedback.
- Oliver Wittchow and Johan Kotlinski for inspiration.

---

## Trivias

- Nimoloop 1.0 was written on Macromedia Director (Lingo) and published as a shockwave web application in 2003. I was a student at the fine arts school in Aix-en-Provence (FR) and coded it as a birthday present for my girlfriend at the time.
- Nimoloop 2.0 was written in 2007, still in Lingo and published as a standalone OSX application distributed as freeware over various audio websites. It offered midi support as well as sample playback.
- Nimo is a slang for "cute animals" in french.