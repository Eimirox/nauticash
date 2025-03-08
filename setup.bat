@echo off
chcp 65001 >nul 2>&1  :: Definit l'encodage UTF-8 pour eviter les problemes d'affichage
setlocal EnableDelayedExpansion

:: Definition des couleurs ANSI (valables uniquement dans certaines consoles compatibles)
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "RESET=[0m"

echo %YELLOW%Verification de Node.js...%RESET%

:: Verifier si Node.js est installe
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo %RED%Node.js n'est pas installe. Installe-le depuis https://nodejs.org/%RESET%
    echo Telecharge-le ici : https://nodejs.org/
    echo.
    echo Fermeture automatique dans 10 secondes...
    timeout /t 10 >nul
    exit /b
)

echo %GREEN%Node.js detecte !%RESET%

echo %YELLOW%Verification du projet Next.js...%RESET%

:: Verifier si le dossier frontend existe deja
if exist frontend (
    echo %GREEN%Le dossier frontend existe deja, pas de nouvelle creation.%RESET%
) else (
    echo %YELLOW%Creation du projet Next.js...%RESET%
    npx create-next-app@latest frontend --use-npm --tailwind --eslint --app --no-src-dir --no-ts --no-turbo --no-alias
)

:: Aller dans le dossier frontend
cd frontend

echo %YELLOW%Installation d'ECharts...%RESET%
npm install echarts

echo %GREEN%Installation terminee avec succes !%RESET%
echo.

echo %YELLOW%Pour demarrer le projet, execute ces commandes :%RESET%
echo ------------------------------------------
echo cd frontend
echo npm run dev
echo ------------------------------------------
echo.

:: Empecher la fermeture immediate de la fenetre
echo %YELLOW%Appuie sur une touche pour fermer cette fenetre...%RESET%
pause >nul
