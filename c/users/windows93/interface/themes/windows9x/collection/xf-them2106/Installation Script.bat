@echo off
cls

REM Automated installation procedure for "X-Files - The Theme v2.0"
REM Version 2.0, August 2, 1996
REM
REM D.Sanders, email: danny@stack.urc.tue.nl
REM
REM This file must be run from Windows 95!

REM ====================================================================================

    echo ===============================================================================
    echo                             X-Files - The Theme v2.0
    echo                        Automated Installation Program v2.0
    echo                                 by Danny Sanders
    echo                                  August 2, 1996
    echo ===============================================================================
    goto windows

REM ====================================================================================

REM Check for Windows environment
:windows
    if "%windir%"=="" goto no_win
    goto longname

REM Check for long filenames.
:longname
    if not exist "Installation Script.bat" goto bad_unzip
    goto plus

REM Check for Plus! installation.
:plus
    if not exist "%windir%\system\themes.cpl" goto bad_plus
    goto vbrun

REM Check for Visual Basic library.
:vbrun
    if not exist "%windir%\system\vbrun300.dll" goto no_vbrun
    goto source

REM Check for source files.
:source
    if not exist logo.sys goto no_logo
    if not exist logos.sys goto no_logos
    if not exist logow.sys goto no_logow
    if not exist "amertype.ttf" goto no_font
    if not exist "Uninstall X-Files logos.bat" goto no_unlogo
    if not exist "Reinstall X-Files logos.bat" goto no_relogo
    if not exist "X-Files Screensaver.scr" goto no_scr
    if not exist "X-Files - The Theme v2.0.theme" goto no_theme
    if not exist "X-Files - The Theme v2.0\nul" goto no_dir
    goto target

REM Check for target folder
:target
    if "%1"=="" goto check_std
    if not exist "%1\nul" goto wrong_dir
    goto cust_copy

REM Check for default target folder
:check_std
    if not exist "c:\program files\plus!\themes\nul" goto no_stdir
    goto std_copy

REM ====================================================================================

REM Installing files to standard folder.
:std_copy
    echo ÿ
    echo Installing files, please wait...
    if not exist "c:\program files\plus!\themes\X-Files - The Theme v2.0\nul" md "c:\program files\plus!\themes\X-Files - The Theme v2.0" >nul
    copy "X-Files - The Theme v2.0\*.*" "c:\program files\plus!\themes\X-Files - The Theme v2.0" >nul
    copy "X-Files - The Theme v2.0.theme" "c:\program files\plus!\themes" >nul
    copy "Uninstall X-Files logos.bat" "c:\program files\plus!\themes" >nul
    copy "Reinstall X-Files logos.bat" "c:\program files\plus!\themes" >nul
    if exist c:\logo.sys if not exist c:\logo.w95 ren c:\logo.sys logo.w95
    copy logo.sys c:\ >nul
    if exist "%windir%\logos.sys" if not exist "%windir%\logos.w95" ren "%windir%\logos.sys" logos.w95
    copy logos.sys %windir% >nul
    if exist "%windir%\logow.sys" if not exist "%windir%\logow.w95" ren "%windir%\logow.sys" logow.w95
    copy logow.sys %windir% >nul
    copy "X-Files Screensaver.scr" %windir% >nul
    copy "amertype.ttf" %windir%\fonts >nul
    goto std_end

REM Installing files to custom folder.
:cust_copy
    echo ÿ
    echo Installing files, please wait...
    if not exist "%1\X-Files - The Theme v2.0\nul" md "%1\X-Files - The Theme v2.0" >nul
    copy "X-Files - The Theme v2.0\*.*" "%1\X-Files - The Theme v2.0" >nul
    copy "X-Files - The Theme v2.0.theme" "%1\" >nul
    copy "Uninstall X-Files logos.bat" "%1\" >nul
    copy "Reinstall X-Files logos.bat" "%1\" >nul
    if exist c:\logo.sys if not exist c:\logo.w95 ren c:\logo.sys logo.w95
    copy logo.sys c:\ >nul
    if exist "%windir%\logos.sys" if not exist "%windir%\logos.w95" ren "%windir%\logos.sys" logos.w95
    copy logos.sys %windir% >nul
    if exist "%windir%\logow.sys" if not exist "%windir%\logow.w95" ren "%windir%\logow.sys" logow.w95
    copy logow.sys %windir% >nul
    copy "X-Files Screensaver.scr" %windir% >nul
    copy "amertype.ttf" %windir%\fonts >nul
    goto cust_end

REM ====================================================================================

REM Start Desktop Themes
:std_end
    echo ÿ
    echo Starting Desktop Themes, please wait...
    if exist "c:\program files\plus!\themes.exe" goto load_it
    start "c:\program files\plus!\themes\X-Files - The Theme v2.0.theme" >nul
    goto finish

REM Apply Theme Settings
:load_it
    "c:\program files\plus!\themes.exe" /s "c:\program files\plus!\themes\X-Files - The Theme v2.0.theme"
    goto done

REM Start Desktop Themes
:cust_end
    echo ÿ
    echo Starting Desktop Themes, please wait...
    start "%1\X-Files - The Theme v2.0.theme" >nul
    goto finish

REM Print message.
:finish
    echo ÿ
    echo X-Files - The Theme v2.0 installed succesfully. You may now close this window
    echo and use "Desktop Themes" to apply the theme's settings to your desktop.
    goto end

REM Print message.
:done
    echo ÿ
    echo X-Files - The Theme v2.0 installed succesfully. Please wait while the theme
    echo is applied to your desktop.
    goto end

REM ====================================================================================

REM Print errormessage
:no_win
  echo ÿ
  echo The installation script hasn't been able to detect Microsoft Windows 95, which
  echo is needed to perform the installation. Please start Windows 95 and try again.
  goto end


REM Print errormessage
:bad_unzip
  echo ÿ
  echo The installation script has detected a problem with the filenames. Most likely
  echo you have used an old unzip program that doesn't support long filenames. Please
  echo refer to the "readme.txt" file for more detailed information.
  goto end

REM Print errormessage
:bad_plus
  echo ÿ
  echo The installation script has detected that you don't have the "Desktop Themes"
  echo from Microsoft Plus! for Windows 95 installed, which is required to use this
  echo theme. Please refer to the documentation for more detailed information.
  goto end

REM Print errormessage
:no_vbrun
  echo ÿ
  echo The installation script has detected that the Visual Basic 3.0 Runtime Library
  echo (vbrun300.dll) is not present in your System folder. This file is required by
  echo the theme's screensaver. The installation will continue normally, but the
  echo screensaver will not work until you have installed this file. Please refer to
  echo the documentation for information on how to obtain this file.
  echo ÿ
  pause
  goto source

REM Print errormessage
:wrong_dir
  echo ÿ
  echo The destination folder you specified does not exist. Please make sure the
  echo specified folder exists.
  goto end

REM Print errormessage
:no_stdir
  echo ÿ
  echo The default destination folder (c:\program files\plus!\themes) does not exist.
  echo Please specify the destination folder on the command line.
  echo ÿ
  echo Example: "Theme installation.bat" "c:\desktop themes"
  goto end

REM Print errormessage
:no_logo
  echo ÿ
  echo The installation script can't find the file "logo.sys". Please make sure that
  echo this file is present in the same folder as the script.
  goto end

REM Print errormessage
:no_logos
  echo ÿ
  echo The installation script can't find the file "logos.sys". Please make sure that
  echo this file is present in the same folder as the script.
  goto end

REM Print errormessage
:no_logow
  echo ÿ
  echo The installation script can't find the file "logow.sys". Please make sure that
  echo this file is present in the same folder as the script.
  goto end

REM Print errormessage
:no_font
  echo ÿ
  echo The installation script can't find the file "Amertype.ttf". Please make sure
  echo that this file is present in the same folder as the script.
  goto end

REM Print errormessage
:no_unlogo
  echo ÿ
  echo The installation script can't find the file "Uninstall X-Files logos.bat".
  echo Please make sure that this file is present in the same folder as the script.
  goto end

REM Print errormessage
:no_relogo
  echo ÿ
  echo The installation script can't find the file "Reinstall X-Files logos.bat".
  echo Please make sure that this file is present in the same folder as the script.
  goto end

REM Print errormessage
:no_scr
  echo ÿ
  echo The installation script can't find the file "X-Files Screensaver.scr". Please
  echo make sure that this file is present in the same folder as the script.
  goto end

REM Print errormessage
:no_theme
  echo ÿ
  echo The installation script can't find the file "X-Files - The Theme v2.0.theme".
  echo Please make sure that this file is present in the same folder as the script.
  goto end

REM Print errormessage
:no_dir
  echo ÿ
  echo The installation script can't find the folder "X-Files - The Theme v2.0".
  echo Please make sure that this folder is present in the same folder as the script.
  goto end

REM ====================================================================================

REM End.
:end
  echo ÿ
