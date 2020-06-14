/**
 * Sparkfun QWIIC Openlog extension for calliope.
 * I2C interface.
 *  
 * GUIDE: https://learn.sparkfun.com/tutorials/qwiic-openlog-hookup-guide
 *   
 * @author Raik Andritschke
 */

//% weight=5 color=#512e5f icon="\uf0c7"
namespace Qwiic_Openlog {

    let QWIIC_OPENLOG_ADDR = 0x2A;

    const I2C_BUFFER_LENGTH = 32;
    const READ_BUFFER_LENGTH = 256;

    const CR = 13;
    const LF = 10;
    const EOF = 255;

    const STATUS_SD_INIT_GOOD = 1;
    const STATUS_LAST_COMMAND_SUCCESS = 2;
    const STATUS_LAST_COMMAND_KNOWN = 4;
    const STATUS_FILE_OPEN = 8;
    const STATUS_IN_ROOT_DIRECTORY = 16;

    const ID = 0x00;
    const STATUS = 0x01;
    const FIRMWAREMAJOR = 0x02;
    const FIRMWAREMINOR = 0x03;
    const I2CADDRESS = 0x1E;
    const LOGINIT = 0x05;
    const CREATEFILE = 0x06;
    const MKDIR = 0x07;
    const CD = 0x08;
    const READFILE = 0x09;
    const STARTPOSITION = 0x0A;
    const OPENFILE = 0x0B;
    const WRITEFILE = 0x0C;
    const FILESIZE = 0x0D;
    const LIST = 0x0E;
    const RM = 0x0F;
    const RMRF = 0x10;
    const SYNCFILE = 0x11;

    let readBuffer: Buffer = pins.createBuffer(READ_BUFFER_LENGTH)
    let readBufferPtr = 0;

    function readByte(register: number): number {
        let cmd: Buffer = pins.createBuffer(1)
        let temp: Buffer = pins.createBuffer(1)
        cmd[0] = register
        pins.i2cWriteBuffer(QWIIC_OPENLOG_ADDR, cmd, false)
        temp = pins.i2cReadBuffer(QWIIC_OPENLOG_ADDR, 1, false)
        return temp[0]
    }

    function writeByte(register: number, value: number): void {
        let temp: Buffer = pins.createBuffer(2);
        temp[0] = register;
        temp[1] = value;
        pins.i2cWriteBuffer(QWIIC_OPENLOG_ADDR, temp, false);
        basic.pause(15)
    }

    function writeBuffer(register: number, buf: Buffer): void {
        let temp: Buffer = pins.createBuffer(buf.length + 1);
        temp[0] = register;
        for (let i = 0; i < buf.length; i++)
            temp[i + 1] = buf[i]
        pins.i2cWriteBuffer(QWIIC_OPENLOG_ADDR, temp, false);
        basic.pause(15)
    }

    function sendCommandString(cmd: number, s: string): void {
        let temp: Buffer = pins.createBuffer(Math.min(s.length, I2C_BUFFER_LENGTH - 1));
        s = s.substr(0, I2C_BUFFER_LENGTH - 1)
        for (let i = 0; i < s.length; i++) {
            temp.setNumber(NumberFormat.Int8LE, i, s.charCodeAt(i));
        }
        writeBuffer(cmd, temp);
    }

    //% blockId="mkDir" block="Erstelle das Verzeichnis %dir"
    //% advanced=true
    export function mkDir(dir: string): void {
        if (dir == '') return;
        sendCommandString(MKDIR, dir)
        writeByte(SYNCFILE, 0);
    }

    //% blockId="rmDir" block="Lösche das Verzeichnis (Wildcards erlaubt) %dir"
    //% advanced=true
    export function rmDir(dir: string): void {
        if (dir == '') return;
        sendCommandString(RMRF, dir)
        writeByte(SYNCFILE, 0);
    }

    //% blockId="changeDir" block="Wechsle in das Verzeichnis %dir"
    //% advanced=true
    export function changeDir(dir: string): void {
        if (dir == '') return;
        sendCommandString(CD, dir)
        writeByte(SYNCFILE, 0);
    }

    //% blockId="createFile" block="Erstelle die Datei %filename"
    export function createFile(filename: string): void {
        if (filename == '') return;
        sendCommandString(CREATEFILE, filename)
        writeByte(SYNCFILE, 0);
    }

    //% blockId="removeFile" block="Lösche die Datei (Wildcards erlaubt) %filename"
    //% advanced=true
    export function removeFile(filename: string): void {
        if (filename == '') return;
        sendCommandString(RM, filename)
        writeByte(SYNCFILE, 0);
    }

    //% blockId="openFile" block="Öffne die Datei zum Schreiben %filename"
    export function openFile(filename: string): void {
        if (filename == '') return;
        sendCommandString(OPENFILE, filename)
    }

    //% blockId="sizeFile" block="Ermittle die Größe der Datei %filename"
    //% advanced=true
    export function sizeFile(filename: string): number {
        if (filename == '') return 0;
        let receivedbuf: Buffer = pins.createBuffer(4)
        sendCommandString(FILESIZE, filename);
        receivedbuf = pins.i2cReadBuffer(QWIIC_OPENLOG_ADDR, 4, false);
        let size = receivedbuf.getNumber(NumberFormat.Int32BE, 0)
        return size;
    }

    //% blockId="readFile" block="Starte Lesen der Datei %filename"
    export function readFile(filename: string): void {
        if (filename == '') return;
        readBufferPtr = 0;
        readBuffer.fill(0);
        writeByte(STARTPOSITION, 0);
        sendCommandString(READFILE, filename);
    }

    //% blockId="readLine" block="Lese nächste Zeile der Datei"
    export function readLine(): string {
        let temp: Buffer = pins.createBuffer(I2C_BUFFER_LENGTH)
        let receivedstr = '';
        let foundCR = false;
        let foundOTHER = false;
        let foundEOF = false;
        while ((!foundEOF) && (!foundCR) && (readBufferPtr < READ_BUFFER_LENGTH)) {
            foundOTHER = false;
            if (readBufferPtr == 0) {
                temp = pins.i2cReadBuffer(QWIIC_OPENLOG_ADDR, I2C_BUFFER_LENGTH, false);
                readBuffer.write(readBufferPtr, temp);
                readBufferPtr = readBufferPtr + I2C_BUFFER_LENGTH;
            }
            if (readBuffer[0] == EOF) {
                foundEOF = true;
            }
            if (readBuffer[0] == CR) {
                foundCR = true;
                readBuffer.shift(1);
                readBufferPtr--;
            }
            // we can define all non-readable chars without control functionality here 
            if (readBuffer[0] == LF) {
                foundOTHER = true;
                readBuffer.shift(1);
                readBufferPtr--;
            }
            if ((!foundCR) && (!foundOTHER) && (!foundEOF)) {
                receivedstr = receivedstr + String.fromCharCode(readBuffer[0]);
                readBuffer.shift(1);
                readBufferPtr--;
            }
        }
        return receivedstr;
    }

    //% blockId="listFiles" block="Starte Lesen der Dateinamen (Wildcards erlaubt) %filename"
    //% advanced=true
    export function searchDir(filename: string): void {
        if (filename == '') filename = '*';
        readBufferPtr = 0;
        readBuffer.fill(0);
        sendCommandString(LIST, filename);
    }

    //% blockId="readFilename" block="Lese nächsten Dateinamen"
    //% advanced=true
    export function readFilename(): string {
        let temp: Buffer = pins.createBuffer(I2C_BUFFER_LENGTH)
        let receivedstr = '';
        let foundFILENAME = false;
        let foundEOF = false;
        temp = pins.i2cReadBuffer(QWIIC_OPENLOG_ADDR, I2C_BUFFER_LENGTH, false);
        let readPtr = 0;
        if (temp[0] == EOF) {
            foundEOF = true;
        }
        while ((!foundEOF) && (!foundFILENAME) && (readPtr < I2C_BUFFER_LENGTH)) {
            if (temp[readPtr] == 0) {
                foundFILENAME = true;
            }
            if (temp[readPtr] == EOF) {
                foundEOF = true;
            }
            if ((!foundFILENAME) && (!foundEOF)) {
                receivedstr = receivedstr + String.fromCharCode(temp[readPtr]);
            }
            readPtr++;
        }
        return receivedstr;
    }

    //% blockId="getStatus" block="Ermittle Status des Moduls"
    //% advanced=true
    export function getStatus(): number {
        return readByte(STATUS)
    }

    //% blockId="getVersion" block="Ermittle Softwareversion des Moduls"
    //% advanced=true
    export function getVersion(): string {
        return readByte(FIRMWAREMAJOR).toString() + '.' + readByte(FIRMWAREMINOR).toString();
    }

    //% blockId="setAddress" block="Setze Adresse des Moduls %addr"
    //% advanced=true
    export function setAddress(addr: number): void {
        QWIIC_OPENLOG_ADDR = addr;
    }

    //% blockId="writeString" block="Schreibe Zeichenkette in Datei %s"
    export function writeString(s: string): void {
        let temp: Buffer = pins.createBuffer(Math.min(s.length, I2C_BUFFER_LENGTH - 1));
        let i: number;
        let ptr: number = 0;
        for (i = 0; i < s.length; i++) {
            temp.setNumber(NumberFormat.Int8LE, ptr, s.charCodeAt(i));
            ptr++;
            if ((ptr == I2C_BUFFER_LENGTH - 1) || (i == s.length - 1)) {
                writeBuffer(WRITEFILE, temp);
                temp.fill(0);
                ptr = 0;
            }
        }
        writeByte(SYNCFILE, 0);
    }

    //% blockId="writeLine" block="Schreibe Zeile in Datei %s"
    export function writeLine(s: string): void {
        writeString(s + String.fromCharCode(CR) + String.fromCharCode(LF));
    }

    //% blockId="writeNumber" block="Schreibe Zahl in Datei %n"
    export function writeNumber(n: number): void {
        writeString(n.toString());
    }

    //% blockId="writeValue" block="Schreibe in Datei Name %s | und Wert %n"
    export function writeValue(s: string, n: number): void {
        writeString(s + ":" + n.toString() + String.fromCharCode(CR) + String.fromCharCode(LF));
    }

}
