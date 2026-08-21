<#
.SYNOPSIS
One-time Windows PowerShell 5.1 setup for React Native / Video-Plucker APK building.
Installs JDK, Android SDK + NDK, Python, configures PATH, accepts SDK licenses.
Re-run is safe (idempotent). Some winget installs may need Administrator.
#>

$ErrorActionPreference = 'Stop'
Write-Host "`n=== Android Dev Toolchain Setup for Video-Plucker ===`n" -ForegroundColor Cyan

# ---- 1. JDK ----
Write-Host ">>> Checking JDK 11+" -ForegroundColor Yellow
$javaReg = Get-ItemProperty -Path 'HKLM:\SOFTWARE\JavaSoft\Java Development Kit\11' -ErrorAction SilentlyContinue
if ($javaReg -and $javaReg.JavaHome -and (Test-Path "$javaReg.JavaHome\bin\java.exe")) {
    $env:JAVA_HOME = $javaReg.JavaHome
    Write-Host "JDK found at $env:JAVA_HOME`n" -ForegroundColor Green
} else {
    Write-Host "JDK not found locally. Attempting winget install..." -ForegroundColor Yellow
    # winget may fail in non-admin; user can install JDK manually from https://adoptium.net/
    try {
        # Only attempt if we have some admin feel; otherwise skip
        $null = winget install --id=Microsoft.OpenJDK.11 --silent 2>$null
        $javaReg2 = Get-ItemProperty -Path 'HKLM:\SOFTWARE\JavaSoft\Java Development Kit\11' -ErrorAction SilentlyContinue
        if ($javaReg2 -and $javaReg2.JavaHome -and (Test-Path "$javaReg2.JavaHome\bin\java.exe")) {
            $env:JAVA_HOME = $javaReg2.JavaHome
            Write-Host "JDK installed via winget at $env:JAVA_HOME`n" -ForegroundColor Green
        } else {
            Write-Warning "winget JDK install did not complete. Download JDK 11+ manually and set JAVA_HOME."
        }
    } catch {
        Write-WingetNotInstalled:
        Write-Warning "winget not available or install failed. Install JDK 11+ manually from https://adoptium.net/ and set `JAVA_HOME`."
    }
}

# ---- 2. Android SDK & NDK ----
Write-Host ">>> Checking Android SDK/NDK" -ForegroundColor Yellow
$androidOk = $false
# Try winget SDK install
try {
    $null = winget install --id=Google.Android.SDK --silent 2>$null
    # SDK location can vary; common places
    $possible = @(
        "$env:LOCALAPPDATA\Android\Sdk"
        (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Google\Android SDK\Location' -ErrorAction SilentlyContinue).Location
        "C:\Program Files\Android\Android SDK"
    )
    foreach ($p in $possible) {
        if (Test-Path (Join-Path $p "platforms\android-33")) {
            $env:ANDROID_HOME = $p
            $androidOk = $true
            break
        }
    }
} catch {
    Write-WWarning "winget SDK install failed or not available."
}
if (-not $androidOk) {
    # Check if SDK already present
    $checkDirs = @(
        "$env:LOCALAPPDATA\Android\Sdk"
        "C:\Users\Xyrus\AppData\Local\Android\Sdk"
    )
    foreach ($d in $checkDirs) {
        if (Test-Path (Join-Path $d "platforms\android-33")) {
            $env:ANDROID_HOME = $d
            $androidOk = $true
            break
        }cd /c
python3 C:\dev\setup_android.py
    }
}
if (-not $androidOk) {
    Write-Host "SDK not found automatically.`n" -ForegroundColor Yellow
    Write-Host "Manual step: Download Android Studio from https://developer.android.com" -ForegroundColor Gray
    Write-Host "Then run: sdkmanager --install 'platforms;android-33' 'build-tools;33.0.2' 'ndk;25.1.8700367'" -ForegroundColor Yellow
    Write-Host "And: sdkmanager --licenses" -ForegroundColor Yellow
}
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not $env:ANDROID_NDK_ROOT) { $env:ANDROID_NDK_ROOT = "$env:ANDROID_HOME\ndk\25.1.8700367" }
if (-not (Test-Path "$env:ANDROID_HOME\platforms")) { mkdir "$env:ANDROID_HOME\platforms" | Out-Null }
Write-Host "ANDROID_HOME set to $env:ANDROID_HOME`n" -ForegroundColor Green

# ---- 3. Python ----
Write-Host ">>> Checking Python 3.x" -ForegroundColor Yellow
if (Get-Command python -ErrorAction SilentlyContinue) {
    $ver = (python --version 2>&1)
    Write-Host "Python 3.x found: $ver`n" -ForegroundColor Green
} else {
    Write-Host "Python not on PATH. Installing via winget..." -ForegroundColor Gray
    try { winget install --id=Python.Python --silent 2>$null } catch { Write-Warning "Python install failed." }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        Write-Host "Python installed: $(python --version)`n" -ForegroundColor Green
    } else {
        Write-Warning "Python not functional. Continue without it (Gradle may complain)."
    }
}

# ---- 4. PATH persistence (PowerShell 5.1 compatible) ----
Write-Host ">>> Configuring PATH permanently" -ForegroundColor Yellow
$psProfile = "$env:USERPROFILE\Microsoft.PowerShell_profile.ps1"
if (Test-Path $psProfile) {
    $pe = "$env:ANDROID_HOME\platform-tools"
    $content = Get-Content $psProfile -Raw
    if ($content -notmatch [regex]::Escape($pe)) {
        $add = "`n# Android SDK platform-tools`n$pe"
        $content += $add
        $content | Out-File -Encoding UTF8 $psProfile
        Write-Host "Added platform-tools to $psProfile`n" -ForegroundColor Green
    }
    $pe2 = "$env:ANDROID_NDK_ROOT"
    $content2 = Get-Content $psProfile -Raw
    if ($content2 -notmatch [regex]::Escape($pe2)) {
        $add2 = "`n# Android NDK`n$pe2"
        $content2 += $add2
        $content2 | Out-File -Encoding UTF8 $psProfile
        Write-Host "Added NDK to $psProfile`n" -ForegroundColor Green
    }
} else {
    Write-Warning "PowerShell profile not found at $psProfile — skip PATH persistence."
}
# Also update current session PATH
$env:PATH = "$env:ANDROID_HOME\platform-tools" + ";" + $env:PATH
$env:PATH = "$env:ANDROID_NDK_ROOT" + ";" + $env:PATH

# ---- 4. Accept SDK licenses (non-interactive) ----
Write-Host ">>> Accepting Android SDK licenses" -ForegroundColor Yellow
$sdkman = "$env:ANDROID_HOME\tools\bin\sdkmanager"
if (Test-Path $sdkman) {
    $licDir = "$env:USERPROFILE\.android\licenses"
    if (-not (Test-Path $licDir)) { mkdir $licDir }
    "8933b159e64ec66d44b15b1e8c8cd688" | Out-File "$licDir\android-sdk-license" -Encoding ascii
    "d5c3e103b3e7a5a5c177868d3bb6c8e8" | Out-File "$licDir\android-ndk-license" -Encoding ascii
    Write-Host "License files created." -ForegroundColor Green
} else {
    Write-Warning "sdkmanager not found at $sdkmanager — run `sdkmanager --licenses` manually."
}

# ---- 5. Verification ----
Write-Host "`n>>> Verification`n" -ForegroundColor Cyan
Write-Host "java: $(java -version 2>&1 | Out-String | Select-String -Pattern 'version' -First 1)" -ForegroundColor White
Write-Host "adb: $(adb version 2>&1 | Out-String | Select-String -Pattern 'Android' -First 1)" -ForegroundColor White
Write-Host "sdk: $env:ANDROID_HOME" -ForegroundColor White
Write-Host "ndk: $env:ANDROID_NDK_ROOT" -ForegroundColor White
Write-Host "python: $(python --version 2>&1)" -ForegroundColor White

Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "1. Close & re-open PowerShell (or run: `. $env:PROFILE`)"
Write-Host "2. Verify: `adb devices` should list your device"
Write-Host "3. Build: `npx react-native run-android` (debug APK + install)"
Write-Host "4. Or: `eas build --platform android --profile preview` (cloud)`n"