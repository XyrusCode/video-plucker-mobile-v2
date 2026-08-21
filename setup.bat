@echo off
:: Android SDK/NDK PATH
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set ANDROID_NDK_ROOT=%ANDROID_HOME%\ndk\25.1.8700367
set PATH=%ANDROID_HOME%\platform-tools;%ANDROID_NDK_ROOT%;%PATH%

:: Accept licenses
mkdir %USERPROFILE%\.android\licenses 2>nul
echo 8933b159e64ec66d44b15b1e8c8cd688 > %USERPROFILE%\.android\licenses\android-sdk-license
echo d5c3e103b3e7a5a5c177868d3bb6c8e8 > %USERPROFILE\.android\licenses\android-ndk-license

:: Verify
echo ANDROID_HOME=%ANDROID_HOME%
echo PATH includes platform-tools: %PATH:|find "platform-tools"%
echo.
echo Please close/reopen your shell, then run: adb devices
pause