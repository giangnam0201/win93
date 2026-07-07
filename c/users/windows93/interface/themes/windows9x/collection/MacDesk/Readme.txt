*****************************************************************************
**                      Macintosh Desktop Theme v.2.1                      **
**                       for MS Plus! for Windows 95                       **
**                                                                         **
**                         Created by Pablo Ayllon                         **
**                             (c) 1996 Parsis                             **
*****************************************************************************


	If you have ever feel that Windows 95's look was close to Macintosh's
perhaps this theme for Microsoft Plus! can help you to complete de illusion.
If you usually work with Macs, this tool can make Windows 95's graphic
environment nicer and more familiar to you, if not, just install it and enjoy
the environment of a great operating system.


-----------------------------------------------------------------------------


 INDEX:

 1. History.
 2. Installation.
 3. Notes about installation.
 4. Tips and tricks.
 5. Files included.
 6. Author's notes.
 7. Copyright information.
 8. Distribution and conditions of use.
 9. Thanks.
10. How to contact.


- 1 - HISTORY ---------------------------------------------------------------


Version 2.1 (07/03/96)

-Animated startup screens.
-New startup and shutdown screens with more definition.
-New 256 colored icons library.
-Minor fixes in animated cursors.
-New wallpapers.
-Filtered, clearer and cleaned sounds.

Version 2.0 (04/09/96)

-New cursors and animated cursors.
-No more .ico files (except the icon HDisk.ico) Now it´s avaliable the icon
 library MacIcons.dll with a complete set of new icons.
-New sounds taken from system MacOS 7.5 (with sounds from internal resources
 and the ROM) and previous versions (7.1) of Apple's OS.
-Now avaliable the most classical Mac's fonts in True Type for Windows.
-New, more and improved wallpapers.
-Start up and shutdown screens for Windows 95.
-Installation theme script for Microsoft Plus!

Version 1.0 (02/24/96)

-First basic version.


- 2 - INSTALLATION-----------------------------------------------------------


	To follow next procedure it's necessary to have Microsoft Plus!
installed in your system. The theme is designed for a minimun of 256 colors
in screen.

1.Uncompress the file "MacDsk21.zip" in the directory or folder called 
  "Themes" usually located at c:\Program files\Plus!\Themes or
  c:\Windows\Plus!\Themes. A new subfolder called "MacDesk" will be created
  and all the theme's files will be placed there. If your uncompressing tool
  doesn't support this feature then you must create a new folder, rename it
  "MacDesk", uncompress there all the files and then move it to "Themes"
  directory.
  Due to some files with long names, you should use an extractor tool for
  Windows 95 which support them such as Winzip ((c) Nico Mak Computing, Inc.)
  6.0 or higher, or similar.
2.Copy all true type fonts (*.ttf) to c:\Windows\Fonts directory
3.Copy the screen saver "Blank Screen.scr" to c:\Windows\System directory if
  don't have it already.
4.Launch the "Desktop Themes" tool from Control Panel and search for the
  file "Macintosh Desktop.theme" placed in the \MacDesk folder and open it.
5.Now you can choose what you want to install or not. Make the theme active.
6.Rename the file usLogo.sys as Logo.sys and copy or move it to C:\
  directory (remember to make a backup copy of your previous Logo.sys if you
  got one)
7.Rename the file usLogow.sys as Logow.sys and the file usLogos.sys as
  Logos.sys and copy or move them to c:\Windows directory (remenber to make
  a backup copy of your previous Logow.sys and Logos.sys)
  You can set the atributtes of Logo.sys, Logow.sys and Logow.sys to hidden,
  system, read-only (+h +s +r) if you find it convenient.
8.Enjoy :-)


- 3 - NOTES ABOUT INSTALLATION ----------------------------------------------


-For viewing 256 colored icons correctly you must check "Show icons using all
 possible colors" option. (At Control Panel -> Screen -> Plus!)

-Mac uses Chicago 12 font for the title bars and menus and Geneva 9 font as
 basic font. Unfortunately this doesn't fit as well in Windows 95. The theme
 sets Chicago 9 font for title bars and menus and Geneva 8 font as auxiliar
 font. I'm not very pleased yet with the resulting look, at least in a
 640x480 screen, but you can always change it if you want. Using Mac fonts
 can make some high characters look wrong.

-Other Mac's fonts, not necesary for the theme, are included although they
 are quite similar to some Windows' ones.

-The theme installs Macos35.bmp wallpaper by default, but you have many
 others avaliable in \MacDesk directory.

-Although they are not used by the theme, there are a great number of
 different icons in the icon library MacIcons.dll that you can use.

-The sounds asisgnament was pretty confused to me. I've selected the sounds
 I found out most appropiated but that's something you can always change if
 you want. Remember there are many unused sounds in \MacDesk directory.

-The color scheme is not exactly like Mac's one due to the different design
 of its windows but I've tried to give a look inspired in the Mac.

-Although Windows 95 themes have been designed to be installed with
 Microsoft Plus!, they can be manually installed without it with a little
 patience and talent. It souldn't be too much complicated for an advance user
 to install the theme without using MS Plus! but it can be tedious, and you
 have to work manually with the Windows 95 registry.


- 4 - TIPS AND TRICKS -------------------------------------------------------


-Set the Start Bar at the top of the screen and choose Autohide
 option.

-Put shortcuts to your floppys, hard disks and CD-ROM on the desktop
 and select suitable icons from MacIcons.dll for them, it´s easier and helps
 to complete the effect.

 Object                    Icon number in MacIcons.dll

 Floppy                    004 Color Mac floppy
 Hard Disk                 014 Hard disk like Copland
 CD-ROM                    015 MacOS System CD-ROM

-Add the Control Panel to the start menu as a drop down menu (this makes the
 start menu more like Mac's apple menu), do the following to get it:

  1. Click Start button with the mouse's right button.
  2. Choose Explore option from the menu.
  3. Place the cursor wherever in the Explorer's right screen and press the
     mouse's right button.
  4. Choose New->Folder option.
  5. Assign this name to the folder, type it exactly:

	Control Panel.{21EC2020-3AEA-1069-A2DD-08002B30309D}

You can do the same with printers, dial up net and the briefcase:

	Printers.{2227A280-3AEA-1069-A2DE-08002B30309D}
	Dial Up Net.{992CFFA0-F557-101A-88EC-00DD010CCC48}
	Briefcase.{85BBD920-42A0-1069-A2E4-08002B30309D}

-Last, you can change the name of the recycle bin and call it "Trash" just
 like in Macintosh. So, edit the system registry with RegEdit and find
 out "Recycle Bin"; possibly, you'll find various references but the one
 we are looking for is:

	HKEY_LOCAL_MACHINE\SOFTWARE\Classes\CLSID\
		{645FF040-5081-101B-9F08-00AA002F954E}\

 Do a double click (or click mouse's right button) on "Default" field which
 is on the right window and change its value to "Trash"

-You can also rename "My PC" icon to "System" or "System Folder"

-Macs has a great feature which is the roll-on effect. It consists in
 rolling up and down a window only leaving visible the title bar. This
 can be achieved in Windows 95 by using WinShade program ((c) Sapphire
 by Mark Rentz and Chris Fuchs). 


- 5 - FILES INCLUDED --------------------------------------------------------


-True Type Fonts:	Chicago.ttf, Geneva.ttf, Helvetic.ttf, Monaco.ttf,
			NewYork.ttf, Palatino.ttf
-Icons:			MacIcons.dll (including icons for trash, hard disks,
			floppys, cdrom, folders, net and printers)
-Cursors:		MacArrow.cur, MacBeam.cur, MacCross.cur, MacHelp.cur,
			MacMove.cur, MacNo.cur, MacPen.cur, MacSize1.cur,
			MacSize2.cur, MacSize3.cur, MacSize4.cur, MacUp.cur,
			MacWatch.cur
-Animated Cursors:	MacBusy.ani, MacRoll.ani, MacWait.ani, Mac3Wait.ani
-Sounds:		Boing.wav, Clink-Klank.wav, Droplet.wav, Flush.wav,
			Indigo.wav, Monkey.wav, Pop.wav, Quack.wav,
			Simple Beep.wav, Sosumi.wav, Start Up.wav, UpSet.wav,
			Wild Eep.wav
-Wallpapers:		MacOS03.bmp, MacOS06.bmp, MacOS08.bmp, MacOS12.bmp,
			MacOS19.bmp, MacOS23.bmp, MacOS35.bmp, MacOS37.bmp,
			MacOS40.bmp, MacOS43.bmp, MacOS46.bmp, MacOS50.bmp,
			MacOS51.bmp, MacOS55.bmp, MacOS56.bmp, MacOS57.bmp
-Screen saver:		Blank Screen.scr
-Screens (spanish):	spLogo.sys, spLogos.sys, spLogow.sys
-Screens (english):	usLogo.sys, usLogos.sys, usLogow.sys
-Script:		Macintosh Desktop.theme
-Documentation:		Readme.txt (english), Leeme.txt (spanish)

			
- 6 - AUTHOR'S NOTES --------------------------------------------------------


-All the icons included in MacIcons.dll has been captured from system MacOS
 7.5 Now they are avaliable at 256 colors and 32x32 pixel format.

-Added to the classical B&W hard disk icon from Macintosh, whose look is
 pretty poor, is included now a color icon for hard disks very close,
 although not equal, to the one offered in the new version of MacOS
 "Copland".

-Some cursors presented here have been taken from Windows 95, with no or
 few modifications.

-Other cursors and the animated cursors have been manually done using models
 from Windows and Macintosh.

-Wallpapers are a selection from the ones included in system MacOS 7.5,
 processed and reduced to 256 colors.

-Some sounds from the Mac's ROM have been captured using dark, secret and
 archaic sorcery ;-) Maybe its quality it's not as good as it could be
 desirable. Flush sound do not belong to Macs, it was found somewhere in the
 net, but it's funny, don't you think so?.

-Startup and shutdown screens had been totally redone starting from zero.
 The brand new Windows 95's startup screen is made from a screenshoot done
 in an Amiga computer running real MacOS 7.5 under emulation.
 Pixelation effect due to resizing the screen from 640x480 to 320x400 has
 been reduced to its minimun. 


- 7 - COPYRIGHT INFORMATION -------------------------------------------------


-All True Type fonts are copyrighted by Apple Computer, Inc., Type
 Solutions, Inc. and The Font Bureau, Inc.
-Apple, the Apple logo, Macintosh, MacOS, the MacOS logo and Copland are
 trademarks of Apple Computer, Inc.
-Microsoft, the Microsoft logo and Windows 95 are registered trademarks of
 Microsoft Corp.
-Mention of other products is only for informational purposes.


- 8 - DISTRIBUTION AND CONDITIONS OF USE ------------------------------------


	The author distribute Macintosh Desktop theme as is, as freeware
software. The author wants to signify that some files included in the
distribution package can be copyrighted. The author just has compiled, in
some cases, certain visual and sonorous aspects of Macintosh computers,
especifiying their ownership. The author is not responsable for the use
that anyone can give to the files here included.
	Macintosh Desktop Theme v.2.1 may be distributed freely, al least
in what it may concern to the author, so long no modifications are made and
no money is ever charged for the theme or it's components. This means, copy
it!

	---> Macintosh Desktop Theme v.2.1 is freeware <---


- 9 - THANKS ----------------------------------------------------------------


-To all users of Macintosh Desktop who has written to me, for his support,
 ideas and colaboration to improve the theme.
-To Toni and his Amiga for helping me with the startup screens.
-To Karl McMurdo and his XrX Animated Logo utility without whom I haven't
 been able to do the animation of startup screens.
-To Jennifer, Simtel's archivist, for being so patiencie with me.

  
- 10 - HOW TO CONTACT -------------------------------------------------------


	For any suggestion or coment you can contact me by e-mail at:

ayllonp@mundivia.es   (new main working e-mail address, use this)
uc162@cclx1.unican.es (only avaliable till middle september 96)
netmail 2:344/16.22

Write to me, your comments will always be welcomed. Though it may not appear
it I have spent a lot of time and spirit in the making of this theme and
I will be very pleased to know that somebody likes it :-)

Pablo Ayllon, August 1996
Member of ACCE (Cantabrian Electronic Mail Association)

Made in Spain.


- APOLOGIES -----------------------------------------------------------------


Forgive my dreadful english, thanks ;-)

