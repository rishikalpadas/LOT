@echo off
echo ================================================
echo   LOT - Building Portable Executable
echo ================================================
echo.

REM Check if PyInstaller is installed
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo Installing PyInstaller...
    pip install pyinstaller
    echo.
)

echo Building LOT.exe...
echo This may take a few minutes...
echo.

REM Build using the spec file
pyinstaller --clean LOT.spec

echo.
if exist "dist\LOT.exe" (
    echo ================================================
    echo   BUILD SUCCESSFUL!
    echo ================================================
    echo.
    echo   Your portable app is ready at:
    echo   dist\LOT.exe
    echo.
    echo   You can copy LOT.exe anywhere and run it.
    echo   The database will be created in the same
    echo   folder as the exe file.
    echo ================================================
) else (
    echo ================================================
    echo   BUILD FAILED!
    echo   Please check the error messages above.
    echo ================================================
)

echo.
pause
