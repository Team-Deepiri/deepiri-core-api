# Git Cleanup Script for api-server
# This script cleans up the git repository to speed up operations

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Git Cleanup - api-server" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check current state
Write-Host "Current git repository state:" -ForegroundColor Yellow
git count-objects -vH
Write-Host ""

# Step 1: Remove garbage objects
Write-Host "Step 1: Removing garbage objects..." -ForegroundColor Yellow
git gc --prune=now
Write-Host "  [OK] Garbage collection complete" -ForegroundColor Green
Write-Host ""

# Step 2: Prune unreachable objects
Write-Host "Step 2: Pruning unreachable objects..." -ForegroundColor Yellow
git prune --expire=now
Write-Host "  [OK] Pruning complete" -ForegroundColor Green
Write-Host ""

# Step 3: Repack objects (compress loose objects into packs)
Write-Host "Step 3: Repacking objects..." -ForegroundColor Yellow
git repack -ad
Write-Host "  [OK] Repacking complete" -ForegroundColor Green
Write-Host ""

# Step 4: Final cleanup
Write-Host "Step 4: Final garbage collection..." -ForegroundColor Yellow
git gc --aggressive --prune=now
Write-Host "  [OK] Final cleanup complete" -ForegroundColor Green
Write-Host ""

# Show new state
Write-Host "New git repository state:" -ForegroundColor Yellow
git count-objects -vH
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Cleanup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your git operations should be much faster now!" -ForegroundColor Green
Write-Host ""

