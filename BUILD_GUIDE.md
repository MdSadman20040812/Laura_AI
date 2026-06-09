# Windows Executable Build Guide (.exe)

This codebase is a native **Tauri 2.0** application. It compiles into a standalone, hardware-accelerated Windows executable (`.exe`) that runs locally on your PC.

To compile it, follow these steps to set up the Windows Build Tools:

---

## 1. Install Visual Studio Build Tools (Required for Rust linker)

Rust on Windows requires the Microsoft C++ Linker (`link.exe`) to compile native binaries.

1. Download the **[Visual Studio Installer](https://visualstudio.microsoft.com/visual-cpp-build-tools/)**.
2. Run the installer and select the workload:
   - **Desktop development with C++**
3. On the right-hand panel, ensure the following components are selected:
   - **MSVC v143 - VS 2022 C++ x64/x86 build tools** (or latest)
   - **Windows 10 SDK** or **Windows 11 SDK**
4. Click **Install** and wait for the download to complete (~2-3 GB).

---

## 2. Compile the Native Executable

Once the Visual Studio Build Tools are installed, open a standard PowerShell terminal in your project directory `d:\Work\AI Video editor` and run the Tauri build command:

```powershell
# Installs dependencies and builds the native Windows installer/executable
npm run tauri build
```

---

## 3. Locate the Compiled Executable

Tauri will compile the application and output a production standalone executable and installer at:

```text
d:\Work\AI Video editor\src-tauri\target\release\tauri-app.exe
```

Double-click the file to launch the editor as a native desktop application window outside of your browser!
