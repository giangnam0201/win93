@echo off
cls

REM Logo uninstallation procedure for "X-Files - The Theme v2.0"
REM Version 2.0, August 2, 1996
REM
REM D.Sanders, email: danny@stack.urc.tue.nl
REM
REM This file must be run from Windows 95!

REM ====================================================================================

    echo ===============================================================================
    echo                             X-Files - The Theme v2.0
    echo                         Logo Uninstallation Program v2.0
    echo                                 by Danny Sanders
    echo                                  August 2, 1996
    echo ===============================================================================
    goto windows

REM ====================================================================================

REM Check for Windows environment
:windows
    if "%windir%"=="" goto no_win
    goto source

REM Check for source files.
:source
    if not exist %windir%\logos.w95 goto no_logos
    if not exist %windir%\logow.w95 goto no_logow
    goto uninstall

REM ====================================================================================

REM Uninstall logos
:uninstall
    echo ÿ
    echo Uninstalling logos, please wait...
    if exist c:\logo.sys if not exist c:\logo.xf2 rename c:\logo.sys logo.xf2
    if exist c:\logo.sys del c:\logo.sys
    if exist c:\logo.w95 rename c:\logo.w95 logo.sys
    if exist %windir%\logow.sys if not exist %windir%\logow.xf2 rename %windir%\logow.sys logow.xf2
    if exist %windir%\logow.sys del %windir%\logow.sys
    rename %windir%\logow.w95 logow.sys
    if exist %windir%\logos.sys if not exist %windir%\logos.xf2 rename %windir%\logos.sys logos.xf2
    if exist %windir%\logos.sys del %windir%\logos.sys
    rename %windir%\logos.w95 logos.sys
    goto done

REM ====================================================================================

REM Display done message
:done
    echo ÿ
    echo Logos succesfully uninstalled.
    goto end

REM ====================================================================================

REM Print errormessage
:no_win
  echo ÿ
  echo The uninstallation script hasn't been able to detect Microsoft Windows 95.
  echo Please start Windows 95 and try again.
  goto end

REM Print errormessage
:no_logos
  echo ÿ
  echo The uninstallation script can't find the backup copy of the shutdown logo.
  echo Without this backup it is not possible to uninstall the logos.
  goto end

REM Print errormessage
:no_logow
  echo ÿ
  echo The uninstallation script can't find the backup copy of the turn-off logo.
  echo Without this backup it is not possible to uninstall the logos.
  goto end

REM ====================================================================================

REM End.
:end
  echo ÿ
