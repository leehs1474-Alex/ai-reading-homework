"use strict";

const API_URL =
  "https://script.google.com/macros/s/AKfycbykgxy9mGqvOZ686S_dcikojosLiw5_3BJ6z92YfSXt_wGRsSmrb0Odv7YEC8eEJ3E/exec";

const classSelect =
  document.getElementById("classSelect");

const studentSelect =
  document.getElementById("studentSelect");

const startButton =
  document.getElementById("startButton");

const statusMessage =
  document.getElementById("statusMessage");

const recordButton =
  document.getElementById("recordButton");

const submitRecordingButton =
  document.getElementById(
    "submitRecordingButton"
  );

let mediaRecorder = null;
let microphoneStream = null;
let recordedChunks = [];
let recordedAudioBlob = null;
let recordingAudioUrl = "";
let recordingTimerId = null;
let recordingSeconds = 0;

let currentStudentId = "";
let currentClassName = "";
let currentHomework = null;
let currentSentence = null;
let currentSentenceIndex = 0;
let isUploadingRecording = false;
let isRetryRecording = false;

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);

async function initializeApp() {
  bindEvents();
  await loadClasses();
}

function bindEvents() {
  classSelect.addEventListener(
    "change",
    handleClassChange
  );

  studentSelect.addEventListener(
    "change",
    handleStudentChange
  );

  startButton.addEventListener(
    "click",
    handleStartClick
  );

  recordButton.addEventListener(
    "click",
    handleRecordButtonClick
  );

  submitRecordingButton.addEventListener(
    "click",
    handleSubmitRecordingClick
  );
}

async function loadClasses() {
  setLoadingState(true);

  try {
    const data =
      await requestApi("getClasses");

    if (!data.success) {
      throw new Error(
        data.message ||
        "반 정보를 불러오지 못했습니다."
      );
    }

    renderClassOptions(
      data.classes || []
    );

    classSelect.disabled = false;

    showStatus(
      "반을 선택해주세요.",
      ""
    );

  } catch (error) {
    console.error(error);

    classSelect.innerHTML =
      '<option value="">반 정보를 불러오지 못했습니다</option>';

    showStatus(
      "반 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
      "error"
    );

  } finally {
    setLoadingState(false);
  }
}

async function handleClassChange() {
  const className =
    classSelect.value;

  resetStudentSelect();
  startButton.disabled = true;

  if (!className) {
    showStatus(
      "반을 선택해주세요.",
      ""
    );
    return;
  }

  studentSelect.innerHTML =
    '<option value="">학생 정보를 불러오는 중...</option>';

  studentSelect.disabled = true;

  showStatus(
    "학생 정보를 불러오고 있습니다.",
    ""
  );

  try {
    const data =
      await requestApi(
        "getStudents",
        {
          className: className
        }
      );

    if (!data.success) {
      throw new Error(
        data.message ||
        "학생 정보를 불러오지 못했습니다."
      );
    }

    renderStudentOptions(
      data.students || []
    );

    studentSelect.disabled = false;

    if (
      !data.students ||
      data.students.length === 0
    ) {
      showStatus(
        "이 반에 등록된 학생이 없습니다.",
        "error"
      );
      return;
    }

    showStatus(
      "이름을 선택해주세요.",
      ""
    );

  } catch (error) {
    console.error(error);

    studentSelect.innerHTML =
      '<option value="">학생 정보를 불러오지 못했습니다</option>';

    showStatus(
      "학생 정보를 불러오지 못했습니다.",
      "error"
    );
  }
}

function handleStudentChange() {
  startButton.disabled =
    !studentSelect.value;

  if (studentSelect.value) {
    showStatus(
      "숙제 시작 버튼을 눌러주세요.",
      "success"
    );
  } else {
    showStatus(
      "이름을 선택해주세요.",
      ""
    );
  }
}

async function handleStartClick() {
  const selectedOption =
    studentSelect.options[
      studentSelect.selectedIndex
    ];

  const studentId =
    studentSelect.value;

  const studentName =
    selectedOption?.textContent || "";

  const className =
    classSelect.value;

  if (!className || !studentId) {
    showStatus(
      "반과 이름을 모두 선택해주세요.",
      "error"
    );
    return;
  }

  startButton.disabled = true;
  startButton.textContent =
    "숙제를 불러오는 중...";

  showStatus(
    `${studentName} 학생의 숙제를 확인하고 있습니다.`,
    ""
  );

  try {
    const data =
      await requestApi(
        "getCurrentHomework",
        {
          studentId: studentId,
          className: className
        }
      );

    if (!data.success) {
      throw new Error(
        data.message ||
        "숙제를 불러오지 못했습니다."
      );
    }

    if (
      !data.hasHomework ||
      !data.homework
    ) {
      showStatus(
        "현재 해야 할 숙제가 없습니다.",
        "success"
      );
      return;
    }

    currentStudentId =
      studentId;

    currentClassName =
      className;

    currentHomework =
      data.homework;

     showHomeworkScreen(
      data.homework
    );

  } catch (error) {
    console.error(error);

    showStatus(
      "숙제를 불러오지 못했습니다. 다시 시도해주세요.",
      "error"
    );

  } finally {
    startButton.disabled = false;
    startButton.textContent =
      "숙제 시작";
  }
}

function showHomeworkScreen(homework) {
  const loginScreen =
    document.getElementById(
      "loginScreen"
    );

  const homeworkScreen =
    document.getElementById(
      "homeworkScreen"
    );

  const homeworkTitle =
    document.getElementById(
      "homeworkTitle"
    );

  const bookTitle =
    document.getElementById(
      "bookTitle"
    );

  const sentences =
    homework.sentences || [];

  if (sentences.length === 0) {
    showStatus(
      "숙제 문장을 찾을 수 없습니다.",
      "error"
    );
    return;
  }

  homeworkTitle.textContent =
    homework.homeworkTitle ||
    "Reading 숙제";

  bookTitle.textContent =
    homework.bookTitle || "";

  loginScreen.classList.add(
    "hidden"
  );

  homeworkScreen.classList.remove(
    "hidden"
  );

  showSentence(0);
}

function showSentence(sentenceIndex) {
  const sentences =
    currentHomework?.sentences || [];

  const sentence =
    sentences[sentenceIndex];

  if (!sentence) {
    showHomeworkStatus(
      "문장을 불러오지 못했습니다.",
      "error"
    );
    return;
  }

  currentSentenceIndex =
    sentenceIndex;

  currentSentence =
    sentence;

  resetRecordingState();

  const sentenceProgress =
    document.getElementById(
      "sentenceProgress"
    );

  const sentenceText =
    document.getElementById(
      "sentenceText"
    );

  sentenceProgress.textContent =
    `문장 ${sentenceIndex + 1} / ${sentences.length}`;

  sentenceText.textContent =
    sentence.sentenceText;

  showHomeworkStatus(
    "문장을 소리 내어 읽어보세요.",
    ""
  );
}

function moveToNextSentence() {
  const sentences =
    currentHomework?.sentences || [];

  const nextSentenceIndex =
    currentSentenceIndex + 1;

  if (
    nextSentenceIndex <
    sentences.length
  ) {
    showHomeworkStatus(
      "잘했어요! 다음 문장으로 이동합니다.",
      "success"
    );

    window.setTimeout(
      function () {
        showSentence(
          nextSentenceIndex
        );
      },
      1200
    );

    return;
  }

  finishCurrentHomework();
}

function finishCurrentHomework() {
  resetRecordingState();

  recordButton.disabled = true;
  submitRecordingButton.disabled = true;

  showHomeworkStatus(
    "모든 문장을 읽었습니다! 숙제를 완료했어요.",
    "success"
  );
}


async function requestApi(
  action,
  parameters = {}
) {
  const url =
    new URL(API_URL);

  url.searchParams.set(
    "action",
    action
  );

  Object.entries(
    parameters
  ).forEach(
    function ([key, value]) {
      url.searchParams.set(
        key,
        value
      );
    }
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",
        redirect: "follow",
        cache: "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      `API 요청 실패: ${response.status}`
    );
  }

  return response.json();
}

async function postApi(
  requestData
) {
  const response =
    await fetch(
      API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body:
          JSON.stringify(
            requestData
          ),

        redirect:
          "follow",

        cache:
          "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      `POST 요청 실패: ${response.status}`
    );
  }

  return response.json();
}

function renderClassOptions(classes) {
  classSelect.innerHTML =
    '<option value="">반을 선택하세요</option>';

  classes.forEach(
    function (className) {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        className;

      option.textContent =
        className;

      classSelect.appendChild(
        option
      );
    }
  );
}

function renderStudentOptions(students) {
  studentSelect.innerHTML =
    '<option value="">이름을 선택하세요</option>';

  students.forEach(
    function (student) {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        student.studentId;

      option.textContent =
        student.studentName;

      studentSelect.appendChild(
        option
      );
    }
  );
}

function resetStudentSelect() {
  studentSelect.innerHTML =
    '<option value="">먼저 반을 선택하세요</option>';

  studentSelect.disabled = true;
}

function setLoadingState(isLoading) {
  if (isLoading) {
    classSelect.disabled = true;
    studentSelect.disabled = true;
    startButton.disabled = true;
  }
}

function showStatus(message, type) {
  statusMessage.textContent =
    message;

  statusMessage.className =
    "status-message";

  if (type) {
    statusMessage.classList.add(
      type
    );
  }
}



async function handleRecordButtonClick() {
  if (isUploadingRecording) {
    return;
  }

  if (
    mediaRecorder &&
    mediaRecorder.state === "recording"
  ) {
    stopRecording();
    return;
  }

  await startRecording();
}

async function startRecording() {
  const recordingPlayer =
    document.getElementById(
      "recordingPlayer"
    );

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia ||
    !window.MediaRecorder
  ) {
    showHomeworkStatus(
      "이 브라우저에서는 녹음 기능을 사용할 수 없습니다.",
      "error"
    );
    return;
  }

  try {
    microphoneStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: true
        });

    isRetryRecording =
  recordButton.textContent.includes(
    "다시"
  );
    recordedChunks = [];
    recordedAudioBlob = null;
    recordingSeconds = 0;

    if (recordingAudioUrl) {
      URL.revokeObjectURL(
        recordingAudioUrl
      );
      recordingAudioUrl = "";
    }

    recordingPlayer.pause();
    recordingPlayer.removeAttribute(
      "src"
    );
    recordingPlayer.classList.add(
      "hidden"
    );

    submitRecordingButton.disabled =
      true;
    submitRecordingButton.classList.add(
      "hidden"
    );

    mediaRecorder =
      new MediaRecorder(
        microphoneStream
      );

    mediaRecorder.addEventListener(
      "dataavailable",
      handleRecordingData
    );

    mediaRecorder.addEventListener(
      "stop",
      handleRecordingStop
    );

    mediaRecorder.start();

    recordButton.textContent =
      "⏹ 녹음 종료";

    recordButton.classList.add(
      "recording"
    );

    showHomeworkStatus(
      "문장을 읽어주세요.",
      ""
    );

    startRecordingTimer();

  } catch (error) {
    console.error(error);
    stopMicrophoneStream();

    showHomeworkStatus(
      getMicrophoneErrorMessage(
        error
      ),
      "error"
    );
  }
}

function handleRecordingData(event) {
  if (
    event.data &&
    event.data.size > 0
  ) {
    recordedChunks.push(
      event.data
    );
  }
}

function stopRecording() {
  if (
    !mediaRecorder ||
    mediaRecorder.state !== "recording"
  ) {
    return;
  }

  mediaRecorder.stop();
  stopRecordingTimer();

  recordButton.textContent =
    "🎤 다시 녹음";

  recordButton.classList.remove(
    "recording"
  );
}

function handleRecordingStop() {
  const recordingPlayer =
    document.getElementById(
      "recordingPlayer"
    );

  const mimeType =
    mediaRecorder?.mimeType ||
    "audio/webm";

  recordedAudioBlob =
    new Blob(
      recordedChunks,
      {
        type: mimeType
      }
    );

  recordingAudioUrl =
    URL.createObjectURL(
      recordedAudioBlob
    );

  recordingPlayer.src =
    recordingAudioUrl;

  recordingPlayer.classList.remove(
    "hidden"
  );

  submitRecordingButton.disabled =
    false;

  submitRecordingButton.classList.remove(
    "hidden"
  );
  submitRecordingButton.textContent =
  isRetryRecording
    ? "✅ AI에게 다시 확인받기"
    : "✅ AI에게 확인받기";

  stopMicrophoneStream();

  showHomeworkStatus(
    "녹음을 들어본 뒤 제출해주세요.",
    "success"
  );
}

async function handleSubmitRecordingClick() {
  if (isUploadingRecording) {
    return;
  }

  if (
    !recordedAudioBlob ||
    recordedAudioBlob.size === 0
  ) {
    showHomeworkStatus(
      "먼저 문장을 녹음해주세요.",
      "error"
    );
    return;
  }

  const homeworkId =
    currentHomework?.homeworkId;

  const sentenceId =
    currentSentence?.sentenceId;

  const expectedText =
    currentSentence?.sentenceText;

  if (
    !currentStudentId ||
    !homeworkId ||
    !sentenceId ||
    !expectedText
  ) {
    console.error({
      currentStudentId,
      homeworkId,
      sentenceId,
      expectedText,
      currentHomework,
      currentSentence
    });

    showHomeworkStatus(
      "제출 정보를 확인하지 못했습니다.",
      "error"
    );
    return;
  }

  setUploadingState(true);

  try {
    const audioBase64 =
      await blobToBase64(
        recordedAudioBlob
      );

    const result =
      await postApi({
        action:
          "uploadRecording",

       studentId:
  currentStudentId,

className:
  currentClassName,

homeworkId:
  homeworkId,

        sentenceId:
          sentenceId,

        expectedText:
          expectedText,

        mimeType:
          recordedAudioBlob.type ||
          "audio/webm",

        audioBase64:
          audioBase64
      });

    if (!result.success) {
      throw new Error(
        result.message ||
        "AI 분석에 실패했습니다."
      );
    }

    console.log(
      "AI 분석 성공",
      result
    );

    isUploadingRecording = false;

submitRecordingButton.textContent =
  "✅ AI 확인 완료";

submitRecordingButton.disabled =
  true;

const retryRequired =
  Boolean(
    result.analysis?.retryRequired
  );

showAIFeedback(
  result.analysis || {}
);

if (retryRequired) {
  recordButton.disabled =
    false;

  recordButton.textContent =
    "🔁 다시 녹음하기";

  submitRecordingButton.disabled =
    true;

  submitRecordingButton.textContent =
    "✅ AI에게 다시 확인받기";

  return;
}

recordButton.disabled =
  true;

window.setTimeout(
  moveToNextSentence,
  1200
);

  } catch (error) {
    console.error(
      "녹음 제출 및 AI 분석 오류",
      error
    );

    showHomeworkStatus(
      "AI 확인에 실패했습니다. 다시 시도해주세요.",
      "error"
    );

    setUploadingState(false);
  }
}

function blobToBase64(blob) {
  return new Promise(
    function (resolve, reject) {
      const reader =
        new FileReader();

      reader.addEventListener(
        "load",
        function () {
          const dataUrl =
            String(
              reader.result || ""
            );

          const commaIndex =
            dataUrl.indexOf(",");

          if (commaIndex === -1) {
            reject(
              new Error(
                "음성 데이터를 변환하지 못했습니다."
              )
            );
            return;
          }

          resolve(
            dataUrl.substring(
              commaIndex + 1
            )
          );
        }
      );

      reader.addEventListener(
        "error",
        function () {
          reject(
            new Error(
              "음성 파일을 읽지 못했습니다."
            )
          );
        }
      );

      reader.readAsDataURL(blob);
    }
  );
}

function setUploadingState(isUploading) {
  isUploadingRecording =
    isUploading;

  if (isUploading) {
    submitRecordingButton.disabled =
      true;

    submitRecordingButton.textContent =
      "⏳ AI가 확인하고 있습니다...";

    recordButton.disabled =
      true;

    showHomeworkStatus(
  "🤖 AI 선생님이 읽기를 확인하고 있습니다...",
  "loading"
);
  } else {
    submitRecordingButton.disabled =
      false;

    submitRecordingButton.textContent =
      "✅ 이 녹음 제출하기";

    recordButton.disabled =
      false;
  }
}

function resetRecordingState() {
  stopRecordingTimer();
  stopMicrophoneStream();

  recordedChunks = [];
  recordedAudioBlob = null;
  recordingSeconds = 0;
  mediaRecorder = null;
  isUploadingRecording = false;
  isRetryRecording = false;

  if (recordingAudioUrl) {
    URL.revokeObjectURL(
      recordingAudioUrl
    );
    recordingAudioUrl = "";
  }

  const recordingPlayer =
    document.getElementById(
      "recordingPlayer"
    );

  recordingPlayer.pause();
  recordingPlayer.removeAttribute(
    "src"
  );
  recordingPlayer.classList.add(
    "hidden"
  );

  recordButton.disabled = false;
  recordButton.textContent =
    "🎤 녹음 시작";
  recordButton.classList.remove(
    "recording"
  );

  submitRecordingButton.disabled =
    true;
  submitRecordingButton.textContent =
    "✅ 이 녹음 제출하기";
  submitRecordingButton.classList.add(
    "hidden"
  );

  updateRecordingTimer();
}

function startRecordingTimer() {
  stopRecordingTimer();
  recordingSeconds = 0;
  updateRecordingTimer();

  const timerElement =
    document.getElementById(
      "recordingTimer"
    );

  timerElement.classList.add(
    "active"
  );

  recordingTimerId =
    window.setInterval(
      function () {
        recordingSeconds += 1;
        updateRecordingTimer();

        if (
          recordingSeconds >= 30
        ) {
          stopRecording();
        }
      },
      1000
    );
}

function stopRecordingTimer() {
  if (recordingTimerId) {
    window.clearInterval(
      recordingTimerId
    );
    recordingTimerId = null;
  }

  const timerElement =
    document.getElementById(
      "recordingTimer"
    );

  if (timerElement) {
    timerElement.classList.remove(
      "active"
    );
  }
}

function updateRecordingTimer() {
  const timerElement =
    document.getElementById(
      "recordingTimer"
    );

  const seconds =
    String(
      recordingSeconds
    ).padStart(
      2,
      "0"
    );

  timerElement.textContent =
    `00:${seconds} / 00:30`;
}

function stopMicrophoneStream() {
  if (!microphoneStream) {
    return;
  }

  microphoneStream
    .getTracks()
    .forEach(
      function (track) {
        track.stop();
      }
    );

  microphoneStream = null;
}

function showHomeworkStatus(
  message,
  type
) {
  const feedbackCard =
    document.getElementById(
      "feedbackCard"
    );

  const homeworkStatus =
    document.getElementById(
      "homeworkStatus"
    );

  const feedbackDetails =
    document.getElementById(
      "feedbackDetails"
    );

  if (
    !feedbackCard ||
    !homeworkStatus ||
    !feedbackDetails
  ) {
    console.error(
      "AI 피드백 카드 요소를 찾지 못했습니다."
    );
    return;
  }

  homeworkStatus.textContent =
    message;

  feedbackDetails.innerHTML = "";

  feedbackDetails.classList.add(
    "hidden"
  );

  feedbackCard.className =
    "feedback-card";

  if (type === "error") {
    feedbackCard.classList.add(
      "feedback-error"
    );
    return;
  }

  if (type === "success") {
    feedbackCard.classList.add(
      "feedback-success"
    );
    return;
  }

  if (type === "loading") {
    feedbackCard.classList.add(
      "feedback-loading"
    );
    return;
  }

  feedbackCard.classList.add(
    "feedback-neutral"
  );
}

function showAIFeedback(analysis) {
  const feedbackCard =
    document.getElementById(
      "feedbackCard"
    );

  const homeworkStatus =
    document.getElementById(
      "homeworkStatus"
    );

  const feedbackDetails =
    document.getElementById(
      "feedbackDetails"
    );

  if (
    !feedbackCard ||
    !homeworkStatus ||
    !feedbackDetails
  ) {
    console.error(
      "AI 피드백 카드 요소를 찾지 못했습니다."
    );
    return;
  }

  const retryRequired =
    Boolean(
      analysis?.retryRequired
    );

  const missingWords =
    Array.isArray(
      analysis?.missingWords
    )
      ? analysis.missingWords
      : [];

  const wrongWords =
    Array.isArray(
      analysis?.wrongWords
    )
      ? analysis.wrongWords
      : [];

  const extraWords =
    Array.isArray(
      analysis?.extraWords
    )
      ? analysis.extraWords
      : [];

  feedbackDetails.innerHTML = "";

  feedbackDetails.classList.remove(
    "hidden"
  );

  feedbackCard.className =
    "feedback-card";

  if (!retryRequired) {
    feedbackCard.classList.add(
      "feedback-success"
    );

    homeworkStatus.textContent =
      "🎉 Excellent! 아주 잘 읽었어요.";

    const nextMessage =
      document.createElement(
        "p"
      );

    nextMessage.className =
      "feedback-retry-message";

    nextMessage.textContent =
      "다음 문장으로 이동합니다.";

    feedbackDetails.appendChild(
      nextMessage
    );

    return;
  }

  feedbackCard.classList.add(
    "feedback-error"
  );

  homeworkStatus.textContent =
    "🔁 다시 읽어보세요!";

  if (missingWords.length > 0) {
    appendFeedbackWords(
      feedbackDetails,
      "빠진 단어",
      missingWords
    );
  }

  if (wrongWords.length > 0) {
    const expectedWords =
      wrongWords
        .map(
          function (item) {
            if (
              item &&
              typeof item === "object"
            ) {
              return item.expected || "";
            }

            return String(
              item || ""
            );
          }
        )
        .filter(Boolean);

    if (expectedWords.length > 0) {
      appendFeedbackWords(
        feedbackDetails,
        "다시 확인할 단어",
        expectedWords
      );
    }
  }

  if (extraWords.length > 0) {
    appendFeedbackWords(
      feedbackDetails,
      "추가로 읽은 단어",
      extraWords
    );
  }

  const retryMessage =
    document.createElement(
      "p"
    );

  retryMessage.className =
    "feedback-retry-message";

  retryMessage.textContent =
    analysis?.feedback ||
    "위 단어를 확인하고 다시 읽어보세요.";

  feedbackDetails.appendChild(
    retryMessage
  );
}

function appendFeedbackWords(
  container,
  title,
  words
) {
  const validWords =
    words
      .map(
        function (word) {
          return String(
            word || ""
          ).trim();
        }
      )
      .filter(Boolean);

  if (validWords.length === 0) {
    return;
  }

  const titleElement =
    document.createElement(
      "p"
    );

  titleElement.className =
    "feedback-detail-title";

  titleElement.textContent =
    title;

  const wordList =
    document.createElement(
      "div"
    );

  wordList.className =
    "feedback-word-list";

  validWords.forEach(
    function (word) {
      const wordElement =
        document.createElement(
          "span"
        );

      wordElement.className =
        "feedback-word";

      wordElement.textContent =
        word;

      wordList.appendChild(
        wordElement
      );
    }
  );

  container.appendChild(
    titleElement
  );

  container.appendChild(
    wordList
  );
}

function getMicrophoneErrorMessage(
  error
) {
  if (
    error.name === "NotAllowedError" ||
    error.name === "SecurityError"
  ) {
    return "마이크 사용을 허용해주세요.";
  }

  if (
    error.name === "NotFoundError"
  ) {
    return "사용 가능한 마이크를 찾을 수 없습니다.";
  }

  if (
    error.name === "NotReadableError"
  ) {
    return "마이크를 다른 프로그램에서 사용 중인지 확인해주세요.";
  }

  return "녹음을 시작하지 못했습니다.";
}
