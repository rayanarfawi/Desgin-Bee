/**
 * TODO : Make a file logger , fix the notification function (Error,Warning,Success)
 */

const electron = require("electron");
const { ipcRenderer } = electron;
let remoteApp = electron.remote.app;
const os = require("os");
const path = require("path");
const fs = require("fs");

const { exec } = require("child_process");

const isDev = require("electron-is-dev");

const cli =
  (isDev ? remoteApp.getAppPath() + "\\resources" : process.resourcesPath) +
  "\\cli\\arduino-cli.exe ";

window.onload = () => {
  let serial_check = document.querySelector("#serial_check");
  update_index().then(
    update_index_res => {
      list_board().then(
        check_boards => {
          // *Important Dummy Variable
          /* check_boards = [
            { port: "COM3", name: "Arduino Uno" },
            { port: "COM7", name: "Arduino Duwmillanove" },
            { port: "COM17", name: "Arduino Uno" }
          ]; */
          if (check_boards.length === 0) {
            //? No Boards found
            icon_dom(serial_check, 1);
            notification(
              `<span>No Arduino found ! Try installing the windows driver</span>
              <a href="#" class="button is-success" style="margin-left:10px" id="install_driver">
              <span class="icon is-small">
              <i class="fas fa-download"></i>
              </span>
              <span>Install</span>
              </a><a href='#' class="button is-link" style="margin-left:5px" id='refresh'>
              <span class="icon is-small">
                <i class="fas fa-redo-alt"></i>
              </span>
            </a>`,
              "warning",
              true
            );

            document
              .querySelector("#install_driver")
              .addEventListener("click", evt => {
                driver_install().then(
                  driver_res => location.reload(true),
                  driver_error => {
                    icon_dom(serial_check, 2);
                    notification(
                      driver_error + " Try Installing the driver again."
                    );
                  }
                );
              });

            document
              .querySelector("#refresh")
              .addEventListener("click", evt => location.reload(true));
          } else if (check_boards.length === 1) {
            icon_dom(serial_check, 0);
            notification(
              `<strong>${
                check_boards[0].name === "unknown"
                  ? "Device"
                  : check_boards[0].name
              }</strong> found at port ${check_boards[0].port}`,
              "success"
            );
            board_selected(check_boards[0]);
          } else if (check_boards.length > 1) {
            //? More than 1 board found
            icon_dom(serial_check, 1);
            let warning_html =
              "<div class='notification is-warning 'style='display: flex;align-items:center'>Multiple Arduinos found , please select :<select id='port_select' name='menu' style='margin-left:10px'>";
            check_boards.forEach(element => {
              warning_html += `<option value='${JSON.stringify(element)}'>${
                element.port
              },( ${
                element.name === "unknown" ? "Device" : element.name
              } )</option>`;
            });
            warning_html +=
              "</select><a href='#' class='button is-success' style='margin-left:10px' id='port_select_btn'><span class='icon is-small'><i class='fas fa-forward'></i></span><span>Next</span></a></div>";
            document.body.insertAdjacentHTML("beforeend", warning_html);
            const port_select_btn = document.querySelector("#port_select_btn");

            port_select_btn.addEventListener("click", evt => {
              board_selected(
                JSON.parse(document.querySelector("#port_select").value)
              );
            });
          } else {
            icon_dom(serial_check, 2);
            notification("Couldn't Select the right board");
          }
        },
        list_boards_error => {
          icon_dom(serial_check, 2);
          notification(list_boards_error);
        }
      );
    },
    update_index_error => {
      icon_dom(serial_check, 2);
      notification(update_index_error);
    }
  );
};

function update_index() {
  return new Promise((resolve, reject) => {
    let child = exec(cli + "core update-index");
    let output = [];
    child.stdout.on("data", data => {
      if (data.includes("Error")) reject(data);
      output.push(data);
    });
    child.stderr.on("data", data => {
      reject(data);
    });
    child.on("close", () => {
      resolve(output);
    });
  });
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

function download_core(progressBar, infoLbl) {
  return new Promise((resolve, reject) => {
    let child = exec(cli + "core install arduino:avr");

    child.stdout.on("data", data => {
      if (data.includes("Error")) reject(data);
      else if (data.includes("already installed")) {
        infoLbl.innerHTML = "Arduino Core already <strong>installed</strong>";
        progressBar.value = 100;
        resolve({ installed: true });
      } else if (
        data.includes("Downloading") ||
        data.includes("Installing") ||
        data.includes("installed")
      )
        infoLbl.innerHTML = data.split("...")[0];

      let data_arr = data.split(" ");
      data_arr.forEach(element => {
        if (element.includes("%"))
          progressBar.value = element.slice(0, element.length - 1);
      });
    });
    child.stderr.on("data", data => {
      reject(data);
    });
    child.on("close", () => {
      progressBar.value = 100;
      resolve({ success: true });
    });
  });
}

function install_lib() {
  return new Promise((resolve, reject) => {
    let child = exec(cli + `lib install "Adafruit TCS34725"`);
    child.stdout.on("data", data => {
      if (data.includes("already exists"))
        resolve({ message: "Already Exist" });
      else if (data.includes("Error")) reject(data);
      else if (data.includes("Installed"))
        resolve({
          message: "Adafruit TCS_34725 library installed successfully"
        });
    });
    child.stderr.on("data", data => {
      reject(data);
    });
    child.on("close", () => {
      resolve({ message: "Done , with no errors" });
    });
  });
}

function driver_install() {
  return new Promise((resolve, reject) => {
    exec(
      (isDev ? remoteApp.getAppPath() + "\\resources" : process.resourcesPath) +
        "\\drivers\\dpinst-amd64.exe /sw",
      (e, out, err) => {
        if (err) reject(err);
        resolve(out);
      }
    );
  });
}

function create_file(content, filename) {
  return new Promise((res, rej) => {
    try {
      let filepath = path.join(os.homedir(), "Bee_Calibrator", "Calibrator");

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

function board_selected(board) {
  let setting_cli_html = `<div class="columns is-mobile">
  <div class="column is-1" style="display: flex;align-items:center" id="setting_cli">
  <img src="../../img/loading-gear.gif" alt="Loading" />
  </div>
  <div class="column is-size-5" style="display: flex;align-items:center">
  <h6>Setting up the <strong> arduino-cli</strong></h6>
  </div>
  </div><progress class="progress is-info" value="0" max="100"></progress>
  <p class="has-text-centered" id='download_lbl'>
  Downloading : <strong>arduino:avr:core </strong>
  </p>`;
  document.body.insertAdjacentHTML("beforeend", setting_cli_html);
  const setting_cli = document.querySelector("#setting_cli");
  const info_lbl = document.querySelector("#download_lbl");
  const progressBar = document.querySelector("progress");

  download_core(progressBar, info_lbl).then(
    download_res => {
      icon_dom(setting_cli, 0);
      progressBar.className = "progress is-success";

      let compiling_html = `</br><div class="columns is-mobile">
      <div class="column is-1" style="display: flex;align-items:center" id="compiling_uploading">
      <img src="../../img/loading-gear.gif" alt="Loading" />
      </div>
      <div class="column is-size-5" style="display: flex;align-items:center">
      <h6><strong>Compiling</strong> and <strong>Uploading</strong> the calibrator code</h6>
      </div>
      </div>`;
      document.body.insertAdjacentHTML("beforeend", compiling_html);
      const compiling_uploading_icon = document.querySelector(
        "#compiling_uploading"
      );

      install_lib().then(
        install_result => {
          //? Refresh board list before compiling to get fqbn
          list_board().then(
            boards => {
              let coreBoard = boards[0];
              boards.forEach(element => {
                if (board.port === element.port) coreBoard = element;
              });
              let calibratorCode = `#include <Wire.h>
              #include "Adafruit_TCS34725.h"
              
              Adafruit_TCS34725 tcs = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_154MS, TCS34725_GAIN_16X);
              
              void setup() {
                Serial.begin(9600);
                if (tcs.begin()) {
                  Serial.println("Found sensor - Design Bee");
                } else {
                  Serial.println("No TCS34725 found ... check your connections");
                  while (1); // halt!
                }
              }
              
              void loop(){
                float r,g,b;
                tcs.getRGB(&r,&g,&b);
                
                Serial.print("R: "); Serial.print(r); Serial.print(" ");
                Serial.print("G: "); Serial.print(g); Serial.print(" ");
                Serial.print("B: "); Serial.print(b); Serial.print(" ");
                Serial.println(" ");
                
                }
              `;
              create_file(calibratorCode, "Calibrator.ino").then(
                filepath => {
                  compile_and_upload(coreBoard, filepath).then(
                    result => {
                      icon_dom(compiling_uploading_icon, 0);
                      notification(
                        `<span>Calibrator code uploaded Successfully , press <strong>Next</strong> to calibrate the device</span>
                        <a href="calibration_page.html" class="button is-link" style="margin-left:10px">
                        <span class="icon is-small">
                        <i class="fas fa-forward"></i>
                        </span>
                        <span>Next</span>
                        </a>`,
                        "success",
                        true
                      );
                      ipcRenderer.send("arduinoPort", coreBoard.port);
                    },
                    compile_upload_error => {
                      icon_dom(compiling_uploading_icon, 2);
                      notification(compile_upload_error);
                    }
                  );
                },
                file_error => {
                  icon_dom(compiling_uploading_icon, 2);
                  notification(file_error);
                }
              );
            },
            refresh_board_error => {
              icon_dom(compiling_uploading_icon, 2);
              notification(refresh_board_error);
            }
          );
        },
        install_error => {
          icon_dom(compiling_uploading_icon, 2);
          notification(install_error);
        }
      );
    },
    download_error => {
      progressBar.className = "progress is-danger";
      icon_dom(setting_cli, 2);
      notification(download_error);
    }
  );
}

function icon_dom(dom, icon) {
  // icon = 0 Success
  // icon = 1 Warning
  // icon = 2 Error
  let fa = "times";
  let color = "hsl(348, 100%, 61%)";
  if (icon === 0) {
    fa = "check-circle";
    color = "#23d160";
  } else if (icon === 1) {
    fa = "exclamation-circle";
    color = "hsl(48, 100%, 67%)";
  }
  dom.innerHTML = `<i class="fas fa-${fa}" style="font-size: 30px;color:${color};"></i>`;
}

function notification(content, notification_type = "danger", center = false) {
  let notification_html = `<div  ${
    center ? "style='display: flex;align-items:center'" : ""
  } class="notification is-${notification_type}">${content}</div>`;
  document.body.insertAdjacentHTML("beforeend", notification_html);
}
