param(
    [Parameter(Mandatory = $true)]
    [string]$WorkbookPath
)

$ErrorActionPreference = 'Stop'
$sourcePath = (Resolve-Path -LiteralPath $WorkbookPath).Path
$temporaryPath = Join-Path ([System.IO.Path]::GetTempPath()) ('qwealth-audit-' + [guid]::NewGuid().ToString() + '.xlsx')
$excelApp = $null
$workbook = $null
$inputSheet = $null
$outputSheet = $null

$defaultEvents = @(
    @{ id = 'default-2'; endYear = 2; type = 'windfall'; amount = 1500.0 },
    @{ id = 'default-6'; endYear = 6; type = 'windfall'; amount = 1000.0 },
    @{ id = 'default-10'; endYear = 10; type = 'windfall'; amount = 1000.0 }
)

function New-Scenario {
    param(
        [string]$Name,
        [double]$Balance = 1650000,
        [double]$Return = 0.075,
        [double]$Inflation = 0.03,
        [double]$Withdrawal = 10000,
        [object[]]$Events = $defaultEvents
    )
    [pscustomobject]@{
        name = $Name
        inputs = [pscustomobject]@{
            startingBalance = $Balance
            annualReturn = $Return
            annualInflation = $Inflation
            monthlyWithdrawal = $Withdrawal
            events = @($Events)
        }
    }
}

$scenarios = @(
    (New-Scenario -Name 'Default'),
    (New-Scenario -Name 'Zero return' -Return 0),
    (New-Scenario -Name 'Zero inflation' -Inflation 0),
    (New-Scenario -Name 'Zero withdrawals' -Withdrawal 0),
    (New-Scenario -Name 'Larger starting balance' -Balance 2500000),
    (New-Scenario -Name 'Lump withdrawal' -Events ($defaultEvents + @{ id = 'out'; endYear = 1; type = 'withdrawal'; amount = 50000.0 })),
    (New-Scenario -Name 'Lump windfall' -Events ($defaultEvents + @{ id = 'in'; endYear = 1; type = 'windfall'; amount = 50000.0 })),
    (New-Scenario -Name 'Negative return' -Return -0.04),
    (New-Scenario -Name 'Early depletion' -Balance 15000 -Events @()),
    (New-Scenario -Name 'Survives projection' -Balance 2500000 -Withdrawal 5000 -Events @()),
    (New-Scenario -Name 'Fractional amounts' -Balance 1234567.89 -Return 0.0425 -Inflation 0.0275 -Withdrawal 4321.09),
    (New-Scenario -Name 'Deflation' -Balance 1000000 -Return 0.02 -Inflation -0.01 -Withdrawal 8000 -Events @()),
    (New-Scenario -Name 'Windfall after depletion' -Balance 10000 -Events @(@{ id = 'revival'; endYear = 2; type = 'windfall'; amount = 1500.0 })),
    (New-Scenario -Name 'Zero balance' -Balance 0 -Withdrawal 0 -Events @()),
    (New-Scenario -Name 'Exact zero closing balance' -Balance 1200 -Return 0 -Inflation 0 -Withdrawal 100 -Events @()),
    (New-Scenario -Name 'Total investment loss' -Balance 1000000 -Return -1 -Withdrawal 1000 -Events @()),
    (New-Scenario -Name 'Tiny positive return' -Return 0.000000001),
    (New-Scenario -Name 'Large monetary values' -Balance 1000000000 -Withdrawal 100000),
    (New-Scenario -Name 'Multiple events in one year' -Events @(
        @{ id = 'a'; endYear = 2; type = 'windfall'; amount = 1000.01 },
        @{ id = 'b'; endYear = 2; type = 'windfall'; amount = 999.99 },
        @{ id = 'c'; endYear = 2; type = 'withdrawal'; amount = 500.25 },
        @{ id = 'late'; endYear = 30; type = 'windfall'; amount = 25000.0 }
    ))
)

$eventYears = @(($scenarios | ForEach-Object { $_.inputs.events } | ForEach-Object { $_.endYear }) + @(2, 6, 10) | Sort-Object -Unique)
$fixtures = [System.Collections.Generic.List[object]]::new()

try {
    Copy-Item -LiteralPath $sourcePath -Destination $temporaryPath
    $excelApp = New-Object -ComObject Excel.Application
    $excelApp.Visible = $false
    $excelApp.DisplayAlerts = $false
    $excelApp.AskToUpdateLinks = $false
    $excelApp.AutomationSecurity = 3
    $workbook = $excelApp.Workbooks.Open($temporaryPath, 0, $false)
    $inputSheet = $workbook.Worksheets.Item('Assumptions')
    $outputSheet = $workbook.Worksheets.Item('DrawdownTable')

    foreach ($scenario in $scenarios) {
        $inputSheet.Range('B3').Value2 = [double]$scenario.inputs.startingBalance
        $inputSheet.Range('B4').Value2 = [double]$scenario.inputs.annualReturn
        $inputSheet.Range('B5').Value2 = [double]$scenario.inputs.annualInflation
        $inputSheet.Range('B6').Value2 = [double]$scenario.inputs.monthlyWithdrawal
        foreach ($eventYear in $eventYears) {
            $rowNumber = [int]$eventYear + 9
            $inputSheet.Range("B$rowNumber").Value2 = 0.0
            $inputSheet.Range("C$rowNumber").Value2 = 0.0
        }
        foreach ($event in $scenario.inputs.events) {
            $rowNumber = [int]$event.endYear + 9
            $column = if ($event.type -eq 'withdrawal') { 'B' } else { 'C' }
            $cell = $inputSheet.Range("$column$rowNumber")
            $cell.Value2 = [double]$cell.Value2 + [double]$event.amount
            [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($cell)
        }
        $excelApp.CalculateFull()
        $values = $outputSheet.Range('C3:H53').Value2
        $rows = [System.Collections.Generic.List[object]]::new()
        $depletionEndYear = $null
        for ($row = 1; $row -le 51; $row++) {
            $financialValues = [double[]]::new(6)
            for ($column = 1; $column -le 6; $column++) {
                $value = $values[$row, $column]
                if ($value -is [int] -and $value -lt -2000000000) {
                    throw "Excel returned a cell error for scenario '$($scenario.name)', row $row, column $column."
                }
                $financialValues[$column - 1] = [double]$value
            }
            $rows.Add($financialValues)
            if ($null -eq $depletionEndYear -and $financialValues[5] -le 0) { $depletionEndYear = $row }
        }
        $fixtures.Add([pscustomobject]@{
            name = $scenario.name
            inputs = $scenario.inputs
            depletionEndYear = $depletionEndYear
            rows = $rows.ToArray()
        })
    }

    ConvertTo-Json -InputObject $fixtures.ToArray() -Depth 12 -Compress
}
finally {
    if ($null -ne $workbook) { $workbook.Close($false) }
    if ($null -ne $excelApp) { $excelApp.Quit() }
    foreach ($comObject in @($outputSheet, $inputSheet, $workbook, $excelApp)) {
        if ($null -ne $comObject) { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($comObject) }
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
    if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath }
}
