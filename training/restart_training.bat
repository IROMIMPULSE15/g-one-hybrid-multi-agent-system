@echo off
echo Stopping any running training processes...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *run_fine_tuning*" 2>nul

echo.
echo Starting optimized fine-tuning...
cd training
python run_fine_tuning_standard.py

pause
