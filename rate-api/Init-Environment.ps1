param (
    [switch]$Recreate 
)

if (-Not (Test-Path .venv)) {
    Write-Host "Creating Virtual Environment..."
    & python -m venv .venv
} else {
    if ($Recreate) {
        Write-Host "Recreating Virtual Environment..."
        Remove-Item -Path ".venv" -Recurse -Force

        & python -m venv .venv
    } else {
        Write-Host "Virtual environment already exists"
    }
}

Write-Host "Activating Environment..."
& .venv/Scripts/activate

if (Test-Path "requirements.txt") {
    Write-Host "Installing Dependencies..."
    pip install -r requirements.txt
}