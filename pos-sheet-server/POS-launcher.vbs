Dim oShell, oFSO
Set oShell = CreateObject("WScript.Shell")
Set oFSO   = CreateObject("Scripting.FileSystemObject")

Dim serverDir, htmlFile
serverDir = "C:\Users\Rin\Desktop\pos-sheet-server\server"
htmlFile  = "C:\Users\Rin\Desktop\2.html"

' Kiem tra xem server da chay chua (kiem tra port 3000)
Dim bAlreadyRunning
bAlreadyRunning = False
Dim oHTTP
On Error Resume Next
Set oHTTP = CreateObject("MSXML2.XMLHTTP")
oHTTP.Open "GET", "http://localhost:3000/health", False
oHTTP.Send
If Err.Number = 0 And oHTTP.Status = 200 Then
    bAlreadyRunning = True
End If
On Error GoTo 0

If Not bAlreadyRunning Then
    ' Khoi dong server o che do an (khong hien cua so CMD)
    oShell.Run "cmd /c cd /d """ & serverDir & """ && node index.js > """ & serverDir & "\server.log"" 2>&1", 0, False

    ' Cho server khoi dong xong (3 giay)
    WScript.Sleep 3000
End If

' Mo 2.html trong trinh duyet mac dinh
oShell.Run "explorer.exe """ & htmlFile & """", 1, False

Set oHTTP  = Nothing
Set oFSO   = Nothing
Set oShell = Nothing
