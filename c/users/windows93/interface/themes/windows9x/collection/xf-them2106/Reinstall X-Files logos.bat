@echo off
cls

REM Logo re-installation procedure for "X-Files - The Theme v2.0"
REM Version 2.0, August 2, 1996
REM
REM D.Sanders, email: danny@stack.urc.tue.nl
REM
REM This file must be run from Windows 95!

REM ====================================================================================

    echo ===============================================================================
    echo                             X-Files - The Theme v2.0
    echo                         Logo Re-installation Program v2.0
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
    if not exist c:\logo.xf2 goto no_logo
    if not exist %windir%\logos.xf2 goto no_logos
    if not exist %windir%\logow.xf2 goto no_logow
    goto reinstall

REM ====================================================================================

REM Re-install logos
:reinstall
    echo ÿ
    echo Re-installing logos, please wait...
    if exist c:\logo.sys if not exist c:\logo.w95 rename c:\logo.sys logo.w95
    if exist c:\logo.sys del c:\logo.sys
    rename c:\logo.xf2 logo.sys
    if exist %windir%\logow.sys if not exist %windir%\logow.w95 rename %windir%\logow.sys logow.w95
    if exist %windir%\logow.sys del %windir%\logow.sys
    rename %windir%\logow.xf2 logow.sys
    if exist %windir%\logos.sys if not exist %windir%\logos.w95 rename %windir%\logos.sys logos.w95
    if exist %windir%\logos.sys del %windir%\logos.sys
    rename %windir%\logos.xf2 logos.sys
    goto done

REM ====================================================================================

REM Display done message
:done
    echo ÿ
    echo Logos succesfully re-installed.
    goto end

REM ====================================================================================

REM Print errormessage
:no_win
  echo ÿ
  echo The re-installation script hasn't been able to detect Microsoft Windows 95.
  echo Please start Windows 95 and try again.
  goto end

REM Print errormessage
:no_logo
  echo ÿ
  echo The re-installation script can't find the theme's startup logo.
  echo Without this logo it is not possible to re-install the theme's logos.
  goto end

:no_logos
  echo ÿ
  echo The re-installation script can't find the theme's shutdown logo.
  echo Without this logo it is not possible to re-install the theme's logos.
  goto end

REM Print errormessage
:no_logow
  echo ÿ
  echo The installation script can't find the theme's turn-off logo.
  echo Without this logo it is not possible to re-install the theme's logos.
  goto end

REM ====================================================================================

REM End.
:end
  echo ÿ
