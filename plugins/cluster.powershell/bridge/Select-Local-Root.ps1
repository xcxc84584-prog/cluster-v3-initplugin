# Opens the Windows native folder picker in the Local Agent user session.
# Return only the selected absolute path on standard output.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
$picker=New-Object System.Windows.Forms.FolderBrowserDialog
$picker.Description='Choose a local workspace folder for Cluster AI Agent'
$picker.ShowNewFolderButton=$false
$picker.RootFolder=[Environment+SpecialFolder]::MyComputer
if($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK){exit 2}
$selected=[IO.Path]::GetFullPath($picker.SelectedPath)
if(!(Test-Path -LiteralPath $selected -PathType Container)){throw 'Folder not found'}
[Console]::Out.WriteLine($selected)
