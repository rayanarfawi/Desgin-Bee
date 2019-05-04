/**
 * TODO: fix all input , on change (URGENT,next release)
 */

const electron = require("electron");
const { remote } = electron;
const SerialPort = require("serialport");
const Readline = require("@serialport/parser-readline");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { exec } = require("child_process");
const isDev = require("electron-is-dev");

const cli =
  (isDev ? remote.app.getAppPath() + "\\resources" : process.resourcesPath) +
  "\\cli\\arduino-cli.exe ";

let r, g, b;
let calibrated_pH = [];
let tones = [];

window.onload = () => {
  let accordions = bulmaAccordion.attach();
  let arduinoPort = remote.getGlobal("arduinoPort");
  if (!arduinoPort) {
    document.body.innerHTML =
      "<div class='notification is-danger is-size-3'><strong>Fatal Error</strong> , please restart app</div>";
    return;
  }

  const port = new SerialPort(
    arduinoPort,
    {
      baudRate: 9600
    },
    error => {
      if (error) {
        let error_html = `<div class="notification is-danger">Error with serial port communication port : (${arduinoPort})</div>`;
        document.body.insertAdjacentHTML("beforeend", error_html);
      }
    }
  );

  const parser = port.pipe(new Readline());
  const sensor_reading_div = document.querySelector("#sensor-reading");
  const sensor_reading_text = document.querySelector("#sensor-reading-text");

  let old_readings = [0, 0, 0];
  let success_readings = 0;
  let multipleStatus = false;
  const multipleStatusDOM = document.querySelector("#sensor-reading-text")
    .lastElementChild;

  parser.on("data", data => {
    if (data.includes("Found sensor - Design Bee"))
      console.warn("Sensor found");
    else {
      let s = data.split(" ");
      r = parseFloat(s[1]);
      g = parseFloat(s[3]);
      b = parseFloat(s[5]);
      sensor_reading_div.style.backgroundColor = `rgb(${r},${g},${b})`;
      sensor_reading_text.children[0].lastChild.data = ` : ${Math.round(r)}`;
      sensor_reading_text.children[1].lastChild.data = ` : ${Math.round(g)}`;
      sensor_reading_text.children[2].lastChild.data = ` : ${Math.round(b)}`;

      success_readings =
        old_readings[0] === Math.round(r) &&
        old_readings[1] === Math.round(g) &&
        old_readings[2] === Math.round(b)
          ? success_readings + 1
          : 0;

      old_readings = [Math.round(r), Math.round(g), Math.round(b)];

      if (success_readings >= 5) {
        multipleStatus = true;
        multipleStatusDOM.lastElementChild.innerHTML =
          '<strong style="color:green">PASS</strong>';
      } else {
        multipleStatus = false;
        multipleStatusDOM.lastElementChild.innerHTML =
          '<strong style="color:red">WAIT</strong>';
      }
    }
  });

  const phInput = document.querySelector("#phInput");
  const freqInput = document.querySelector("#freqInput");
  const delayInput = document.querySelector("#delayInput");
  const repeatInput = document.querySelector("#repeatInput");
  const multipleReadingInput = document.querySelector("#multipleReadingInput");
  let phInputVal = 1;
  let freqInputVal = 1000;
  let delayInputVal = 150;
  let repeatInputVal = 1;
  let multipleReadingInputVal = 8;
  const startToneCheck = document.querySelector("#start_tone_check");
  const serialCheck = document.querySelector("#serial_check");

  // Buttons Event Listeners
  document.querySelector("#assign-btn").addEventListener("click", evt => {
    if (!multipleStatus) {
      messageBox("Wait until it passes multiple readings for accuracy !!");
      return;
    }

    if (phInput.value < 1 || phInput.value > 14) {
      messageBox("pH Value must be between 1 and 14 !");
      phInput.value = phInput.value < 1 ? 1 : 14;
      return;
    }

    let override = true;
    calibrated_pH.forEach((element, i) => {
      if (element && i === phInput.value - 1) {
        override = false;
        remote.dialog.showMessageBox(
          {
            type: "warning",
            buttons: ["Yes", "No"],
            message: `pH Value ${i + 1} is already set would you override it ?`
          },
          res => {
            if (res === 0) {
              calibrated_pH[phInput.value - 1] = [r, g, b];
              tones[phInput.value - 1] = [
                freqInputVal,
                delayInputVal,
                repeatInputVal
              ];
              if (phInput.value < 14) {
                phInput.value++;
                // Dumb fix , but hey get the job done (Not Urgent fix)
                phInputVal = phInput.value;
                freqInput.value = 1000 + (phInputVal - 1) * 200;
                freqInputVal = 1000 + (phInputVal - 1) * 200;
              }
            }
          }
        );
      }
    });
    if (override) {
      calibrated_pH[phInput.value - 1] = [r, g, b];
      tones[phInput.value - 1] = [freqInputVal, delayInputVal, repeatInputVal];
      if (phInput.value < 14) {
        phInput.value++;
        // Dumb fix , but hey get the job done (Not Urgent fix)
        phInputVal = phInput.value;
        freqInput.value = 1000 + (phInputVal - 1) * 200;
        freqInputVal = 1000 + (phInputVal - 1) * 200;
      }
    }
  });
  document.querySelector("#current_tone").addEventListener("click", evt => {
    playTone(freqInputVal, delayInputVal, repeatInputVal);
  });
  document.querySelector("#start_tone").addEventListener("click", evt => {
    playNote(1000, 200).then(res =>
      playNote(2000, 200).then(res => playNote(3000, 200))
    );
  });
  document.querySelector("#generate_btn").addEventListener("click", evt => {
    //Sanitize data then call generate function
    // userTone,ph,startTone,maxReads
    //check if notification
    let el = document.body.lastElementChild;
    if (el.classList.contains("notification")) el.remove();
    let settings = new Object();
    let phCount = 0;
    let toneCount = 0;
    calibrated_pH.forEach(element => {
      if (element) phCount++;
    });
    tones.forEach(element => {
      if (element) toneCount++;
    });
    if (phCount === 14 && toneCount === 14) {
      settings.ph = calibrated_pH;
      settings.userTone = tones;
      settings.serialPrint = serialCheck.checked;
    } else {
      notification("Assigned pH not equal to 14 !", "warning");
      return;
    }
    settings.startTone = startToneCheck.checked;
    settings.maxReads = multipleReadingInputVal;
    let generatedCode = generate_code(settings);

    //Close Port
    port.close(function(err) {
      if (err) {
        notification(`couldn't close port :(${arduinoPort})\n${err}`);
        return;
      }
    });
    //
    document.querySelector("#generate_btn").className += " is-loading";

    create_file(generatedCode, "Bee.ino").then(
      filepath => {
        list_board().then(
          boards => {
            let board = boards[0];
            if (boards.length > 1)
              board = boards.find(element => {
                return element.port === arduinoPort;
              });
            if (boards.length === 0) throw "No Boards Found";
            compile_and_upload(board, filepath).then(
              success => {
                document.location.href = "end_page.html";
              },
              compile_error => {
                notification(compile_error);
                console.error(compile_error);
                document
                  .querySelector("#generate_btn")
                  .classList.remove("is-loading");
              }
            );
          },
          list_error => {
            notification(list_error);
            console.error(list_error);
            document
              .querySelector("#generate_btn")
              .classList.remove("is-loading");
          }
        );
      },
      file_error => {
        notification(file_error);
        console.error(file_error);
        document.querySelector("#generate_btn").classList.remove("is-loading");
      }
    );
  });

  // Input Event Listeners
  phInput.addEventListener("change", evt => {
    if (phInput.value < 1 || phInput.value > 14) {
      messageBox("pH Value must be between 1 and 14 !");
      phInput.value = phInput.value < 1 ? 1 : 14;
    } else {
      phInputVal = phInput.value;
      repeatInput.value = phInputVal;
      repeatInputVal = phInputVal;
      freqInput.value = 1000 + (phInputVal - 1) * 200;
      freqInputVal = 1000 + (phInputVal - 1) * 200;
    }
  });

  freqInput.addEventListener("change", evt => {
    if (isNaN(freqInput.value)) {
      messageBox("Frequency must be a numnber");
      freqInput.value = 1000;
    } else if (freqInput.value < 100 || freqInput.value > 10000) {
      messageBox(
        "Frequency is between 100 and 10000 Hz, other than this sound will be anoying !"
      );
      freqInput.value = freqInput.value < 100 ? 100 : 10000;
    } else freqInputVal = freqInput.value;
  });

  delayInput.addEventListener("change", evt => {
    if (isNaN(delayInput.value)) {
      messageBox("Delay must be a numnber");
      delayInput.value = 150;
    } else if (delayInput.value < 50 || delayInput.value > 1000) {
      messageBox("Delay is between 50 and 1000 ms !");
      delayInput.value = delayInput.value < 50 ? 50 : 1000;
    } else delayInputVal = delayInput.value;
  });

  repeatInput.addEventListener("change", evt => {
    if (repeatInput.value < 1 || repeatInput.value > 30) {
      messageBox("Repeat Value must be between 1 and 30 !");
      repeatInput.value = repeatInput.value < 1 ? 1 : 30;
    } else repeatInputVal = repeatInput.value;
  });

  multipleReadingInput.addEventListener("change", evt => {
    if (multipleReadingInput.value < 1 || multipleReadingInput.value > 20) {
      messageBox("Maximum multiple readings are set to 20 for speed reason !");
      multipleReadingInput.value = multipleReadingInput.value < 1 ? 1 : 20;
    } else multipleReadingInputVal = multipleReadingInput.value;
  });
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playNote(frequency, duration, gain = 0.01) {
  // create Oscillator node
  const oscillator = audioCtx.createOscillator();

  oscillator.type = "square";
  oscillator.frequency.value = frequency; // value in hertz

  const gainNode = audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  gainNode.gain.value = gain;
  oscillator.start();

  return new Promise(res => {
    setTimeout(function() {
      oscillator.stop();
      res();
    }, duration);
  });
}

async function playTone(freq, delay, repeat) {
  for (var i = 0; i < repeat; i++) {
    await playNote(freq, delay);
    await playNote(0, delay);
  }
}

function messageBox(message, type = "error") {
  remote.dialog.showMessageBox({
    type: type,
    message: message
  });
}

function generate_code(settings) {
  let user_tone = "{";
  settings.userTone.forEach(element => {
    user_tone += "{" + element.toString() + "},";
  });
  user_tone = user_tone.slice(0, user_tone.length - 1);
  user_tone += "};";

  let calib_ph = "{";
  settings.ph.forEach(element => {
    calib_ph += "{" + element.toString() + "},";
  });
  calib_ph = calib_ph.slice(0, calib_ph.length - 1);
  calib_ph += "};";

  let code = `
  #include <Wire.h>
  #include "Adafruit_TCS34725.h"
  #define PH_NUMBER 14
  
  
  Adafruit_TCS34725 tcs = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_154MS, TCS34725_GAIN_16X);
  
  const int buzzer = 4;
  const int user_tone[PH_NUMBER][3]=${user_tone}
  const float ph[PH_NUMBER][3] = ${calib_ph}
      
  
  float idleVal[3];
  
  void setup()
  {
    Serial.begin(9600);
    if (tcs.begin())
    {
      Serial.println("Found sensor");
      ${
        settings.startTone
          ? `
      tone(buzzer,1000);
      delay(200);
      tone(buzzer,2000);
      delay(200);
      tone(buzzer,3000);
      delay(200);
      noTone(buzzer);
      delay(3000);
      `
          : ``
      }
    }
    else
    {
      Serial.println("No TCS34725 found ... check your connections");
      while (1); // halt!
    }
  
    tcs.getRGB(&idleVal[0], &idleVal[1], &idleVal[2]);
  }
  
  int oldph;
  int success_read = 1;
  const int max_reads = ${settings.maxReads};
  const int idleThreshold = 2;
  
  void loop()
  {
    float r, g, b;
    tcs.getRGB(&r, &g, &b);
    
    if (!(abs(r - idleVal[0]) <= idleThreshold && abs(g - idleVal[1]) <= idleThreshold && abs(b - idleVal[2]) <= idleThreshold))
    {
      //Serial.print("Sensing Something !");Serial.println(" ");
      int ph_val = 0;
      float diff = 1000;
      for (int i = 0; i < PH_NUMBER; i++)
      {
        float curr_diff = pow((r - ph[i][0]) * 0.299, 2) + pow((g - ph[i][1]) * 0.587, 2) + pow((b - ph[i][2]) * 0.114, 2);
        if (curr_diff < diff)
        {
          diff = curr_diff;
          ph_val = i + 1;
        }
      }
      if (ph_val != 0)
      {
        if (ph_val == oldph)
          success_read++;
        else
        {
          success_read == 1;
          oldph = ph_val;
        }
        if (success_read == max_reads)
        {
          ${
            settings.serialPrint
              ? `
          Serial.print("PH = ");Serial.print(ph_val);Serial.println(" ");
          `
              : ``
          }
          playTone(user_tone[ph_val-1][0],user_tone[ph_val-1][1],user_tone[ph_val-1][2]);
          success_read = 1;
          oldph = 0;

        }
      }
    }
  }

  void playTone(int f,int d,int r){
    for(int i=0;i<r;i++){
      tone(buzzer,f);
      delay(d);
      noTone(buzzer);
      delay(d);
    }
  }
  `;
  return code;
}

function notification(content, notification_type = "danger", center = false) {
  let notification_html = `<div  ${
    center ? "style='display: flex;align-items:center'" : ""
  } class="notification is-${notification_type}">${content}</div>`;
  document.body.insertAdjacentHTML("beforeend", notification_html);
}

function list_board() {
  return new Promise((resolve, reject) => {
    let child = exec(cli + "board list --format json");
    let output = "";
    child.stdout.on("data", data => {
      output += data;
    });
    child.stderr.on("data", data => {
      reject(data);
    });
    child.on("close", () => {
      try {
        resolve(JSON.parse(output).serialBoards);
      } catch (error) {
        reject(error.message);
      }
    });
  });
}

function compile_and_upload(board, sketch) {
  return new Promise((res, rej) => {
    exec(`${cli}compile --fqbn ${board.fqbn} ${sketch}`, (e, out, err) => {
      if (out.includes("Compilation failed.")) {
        rej("Compilation Failed");
        return;
      }
      exec(
        `${cli}upload -p ${board.port} --fqbn ${board.fqbn} ${sketch}`,
        (upload_e, upload_out, upload_err) => {
          if (upload_out.includes("Error during upload"))
            rej("Error during upload");
          if (upload_out === "")
            res("Sketch Compiled and uploaded successfully");
          else rej("Upload Error (UNKNOWN Error) , Check log file");
        }
      );
    });
  });
}

function create_file(content, filename) {
  return new Promise((res, rej) => {
    try {
      let filepath = path.join(os.homedir(), "Bee_Calibrator", "Bee");

      if (!fs.existsSync(filepath)) {
        if (!fs.existsSync(path.join(os.homedir(), "Bee_Calibrator")))
          fs.mkdirSync(path.join(os.homedir(), "Bee_Calibrator"));

        fs.mkdirSync(filepath);
      }

      fs.writeFileSync(path.join(filepath, filename), content);

      res(filepath);
    } catch (error) {
      rej(error.message);
    }
  });
}
