import { randomItem } from "../../../../42/lib/type/array/randomItem.js"
import { dialog } from "../../../../42/ui/layout/dialog.js"

const verbs = `\
Calculating
Executing
Computing
Loading
Downloading
Generating
Compiling
Formating
Inserting
Browsing
Accessing
Configuring
Connecting
Forwarding
Manipulating
Pasting
Scanning
Searching
Processing
Performing
Selecting
Translating
Writing
Transforming
Unzipping
Logging
Updating
Checking
Decompressing
Exploring
Deleting
Surfing
Initializing
Confirming
Delaying
Messing`.split("\n")

const preNames = `\
Adobe
super
random
Microsoft
virtual
MOAR
less
Google
pizza
GNU
3D
NVIDIA
Voodoo 3D
3dfx
MEGA
Mozilla
facebook
ultimate
last
next level
wizard
unkwown
hacked
spammed
trojan
data
securised
unsecurised
Valve
epic
over9000
shader
script
module
kitten
teh
lol
troll
meme
software
hardware
half of
first
last
c++
system
VR
emoji
sudo
user
scene
clock
polygon
overclocked
Radeon
Pro SSG
AMD
ultra HD
PRO
perfect-match
high-end
TITAN X
low-cost
GTX
Pascal-powered
Geforce
new
extreme
fury
furry
R4
nano
memory
gaming
8GB
Tri-X
gaming edition
CERN
Nintendo
Gabe Newell's
video game
GoldSrc
John Carmack's
encrypted
forked
fasted
slowed
modded
updated
major
minor
alpha
beta
hard-coded
modern
Steam
OpenGL
SDL
handled
game developer's
Vulkan
Source 2
workshop
static
porn
lag-compensated
hight dynamic range
scalable
facial
pre-computed
auto-generated
skeletal
inversed
signifiant
keyframed
Gentoo
QuickTime
ChatGPT
GLaDOS
`.split("\n")

const names = `\
GPU
CPU
VRAM
anti-aliasing
frame buffer
code
bot
API
laptop
development kit
reality
SDK
tool
3d
model
client
source
branch
build
core
Orange Box
cat
episode
mod
dog
connectors
Quake engine
address
algorithm
email
C++
data
database
document
disk operating system
desktop
ENIAC
electricity
moar ram
attachment
online server
datacenter
explorer
filesystem
file allocation table
pizza
pizza.dll
player
folder
footnotes
freeware
firewall
file
teh internet
format
freeBSD
FTP
Gimp
GNU
hacker
4chan
hard disk
hardware
software
hash_function
cookie
java
kernel
system32.dll (are you sure?)
keyboard
mouse
link
licensing examples for computer software
live cd
malware
Macintosh
md5
media
megabyte
spam
spammer
scam
scammer
monitor
motherboard
Mozilla Firefox web browser
network
computer
page
Perl script
script
program
release
printer
GPS
PDF
pop up
plug-in
python
random access memory
read only memory
root
Recycle Bin
scan
engine
search engine
shareware
spreadsheet
stylesheet
super computer
super user
SDK
trojan
trojan horse
Ubuntu
update
user
USB
version
virtual community
Visual Basic
virus
vulnerability
window
Wine
X32
X64
Yahoo!
ZIP
like a boss
manager
setup
Service Pack 1
Service Pack 2
Service Pack 3
shit
virus
particule
module
panda
corgi
generator
Half Life 3
Gabe Newell
center
CD-ROM
Source 3
porn
youtuber
steam
pokemon go
home
overclock
graphic card
Team Fortress
milf
Left 4 Dead
linux support`.split("\n")

let dialogEl

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  const img = new Image()
  img.draggable = false
  img.className = "action-false"
  img.src = import.meta.resolve("./splash.jpg")

  await img.decode()

  dialogEl = await dialog({
    label: "Half-Life 3",
    picto: app.getIcon(),
    class: "animation-false",
    // header: false,
    maximizable: false,
    minimizable: false,
    resizable: false,
    clear: true,
    skipAutoPosition: true,
    width: img.naturalWidth,

    content: [
      img,
      {
        class: "fit txt-center action-false",
        style: {
          font: '12px/1 "Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif',
          color: "#fff",
          boxShadow: "4px 5px 6px 0px rgb(0, 0, 0, 0.5)",
        },
        content: [
          {
            tag: "div",
            style: {
              marginTop: "45px",
              fontSize: "45px",
              fontWeight: "bold",
            },
            content: [
              "Half-Life", //
              {
                tag: "sup",
                style: {
                  fontSize: "16px",
                  verticalAlign: "21px",
                },
                content: "3",
              },
            ],
          },
          {
            style: { marginTop: "8px" },
            content: "CONFIRMED",
          },
          {
            id: "hl3__loading",
            style: { marginTop: "240px" },
            content: "\u200B",
          },
          {
            style: { marginTop: "4px", color: "#999" },
            content: "Please wait",
          },
        ],
      },
    ],

    on: {
      "ui:dialog.close"() {
        app.destroy()
      },
    },
  })

  const textEl = dialogEl.querySelector(":scope #hl3__loading")

  function init() {
    if (app.signal.aborted) return

    textEl.textContent = `\
      ${randomItem(verbs)}
      ${Math.random() > 0.5 ? randomItem(preNames) : ""}
      ${randomItem(preNames)}
      ${randomItem(names)}...`

    setTimeout(init, Math.random() * 2000)
  }

  init()
}

export function destroyApp() {
  dialogEl?.close()
}
