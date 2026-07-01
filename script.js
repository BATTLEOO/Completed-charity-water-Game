// Variables to control game state
let gameRunning = false; // Keeps track of whether game is active or not
let dropMaker; // Will store our timer that creates drops regularly
let timerTick; // Stores countdown interval
let challengeTimer;
let challengeEndTimer;
let obstacleMaker;
let score = 0;
let timeLeft = 30;
let challengeActive = false;
let celebrationTimeout;
let currentSettings;
let audioContext;

const DIFFICULTY_SETTINGS = {
  easy: {
    label: "Easy",
    timeLimit: 40,
    targetScore: 16,
    dropInterval: 850,
    badDropChance: 0.12,
    challengeBadDropChance: 0.3,
    dirtyPenalty: 2,
    challengeDirtyPenalty: 4,
    missPenalty: 1,
    challengeMissPenalty: 1,
    challengeDelayMin: 8000,
    challengeDelayMax: 12000,
    challengeDuration: 3200,
    obstacleInterval: 1200
  },
  normal: {
    label: "Normal",
    timeLimit: 30,
    targetScore: 20,
    dropInterval: 700,
    badDropChance: 0.2,
    challengeBadDropChance: 0.45,
    dirtyPenalty: 3,
    challengeDirtyPenalty: 5,
    missPenalty: 1,
    challengeMissPenalty: 2,
    challengeDelayMin: 5000,
    challengeDelayMax: 8000,
    challengeDuration: 4500,
    obstacleInterval: 900
  },
  hard: {
    label: "Hard",
    timeLimit: 24,
    targetScore: 26,
    dropInterval: 560,
    badDropChance: 0.3,
    challengeBadDropChance: 0.6,
    dirtyPenalty: 4,
    challengeDirtyPenalty: 6,
    missPenalty: 2,
    challengeMissPenalty: 3,
    challengeDelayMin: 3500,
    challengeDelayMax: 6500,
    challengeDuration: 5600,
    obstacleInterval: 650
  }
};

const winningMessages = [
  "Amazing work! You helped protect clean water.",
  "You win! Great job catching those clean drops.",
  "Water hero! You reached the clean water goal.",
  "Fantastic! You beat the challenge and kept water clean."
];

const losingMessages = [
  "Try again! Keep focusing on clean drops.",
  "Almost there. Try again and avoid dirty drops.",
  "Good effort! Try again to hit the goal.",
  "Keep going! You can hit the clean water goal next round."
];

const startButton = document.getElementById("start-btn");
const resetButton = document.getElementById("reset-btn");
const gameContainer = document.getElementById("game-container");
const scoreDisplay = document.getElementById("score");
const timeDisplay = document.getElementById("time");
const targetScoreDisplay = document.getElementById("target-score");
const difficultySelect = document.getElementById("difficulty-select");
const challengeStatusDisplay = document.getElementById("challenge-status");
const feedbackDisplay = document.getElementById("feedback-message");
const feedbackText = feedbackDisplay.querySelector("span");
const celebrationOverlay = document.getElementById("celebration-overlay");

currentSettings = DIFFICULTY_SETTINGS[difficultySelect.value] || DIFFICULTY_SETTINGS.normal;
updateTargetScoreDisplay();

difficultySelect.addEventListener("change", () => {
  currentSettings = DIFFICULTY_SETTINGS[difficultySelect.value] || DIFFICULTY_SETTINGS.normal;
  updateTargetScoreDisplay();
  if (!gameRunning) {
    timeLeft = currentSettings.timeLimit;
    updateTime();
    setFeedback(`${currentSettings.label} mode selected. Goal: ${currentSettings.targetScore} points in ${currentSettings.timeLimit}s.`, "good");
  }
});

// Wait for button click to start the game
startButton.addEventListener("click", startGame);
resetButton.addEventListener("click", resetGame);

function startGame() {
  // Prevent multiple games from running at once
  if (gameRunning) return;

  currentSettings = DIFFICULTY_SETTINGS[difficultySelect.value] || DIFFICULTY_SETTINGS.normal;
  initAudio();
  gameRunning = true;
  score = 0;
  timeLeft = currentSettings.timeLimit;
  updateScore();
  updateTime();
  updateTargetScoreDisplay();
  updateChallengeStatus("Calm", false);
  clearTimeout(celebrationTimeout);
  clearCelebration();
  gameContainer.innerHTML = "";
  startButton.textContent = "Playing...";
  difficultySelect.disabled = true;
  setFeedback(
    `${currentSettings.label} mode: score ${currentSettings.targetScore} points in ${currentSettings.timeLimit}s. Clean drops are +2 and dirty drops cost more during surges.`,
    "good"
  );

  // Create new drops every second (1000 milliseconds)
  dropMaker = setInterval(createDrop, currentSettings.dropInterval);
  timerTick = setInterval(updateGameTimer, 1000);
  scheduleChallenge();
}

function createDrop() {
  if (!gameRunning) return;

  // Create a new div element that will be our water drop
  const drop = document.createElement("div");
  drop.className = "water-drop";

  const badDropChance = challengeActive ? currentSettings.challengeBadDropChance : currentSettings.badDropChance;
  const isBadDrop = Math.random() < badDropChance;
  if (isBadDrop) {
    drop.classList.add("bad-drop");
  }

  // Make drops different sizes for visual variety
  const initialSize = 60;
  const sizeMultiplier = Math.random() * 0.8 + 0.5;
  const size = initialSize * sizeMultiplier;
  drop.style.width = drop.style.height = `${size}px`;

  // Position the drop randomly across the game width
  // Subtract 60 pixels to keep drops fully inside the container
  const gameWidth = gameContainer.offsetWidth;
  const xPosition = Math.random() * (gameWidth - size);
  drop.style.left = xPosition + "px";

  // Make drops fall slower for easier tracking and tapping
  drop.style.animationDuration = `${Math.random() * 2 + 4.5}s`;
  drop.style.setProperty("--drop-fall-distance", `${gameContainer.clientHeight + 30}px`);
  let dropHandled = false;

  drop.addEventListener("click", (event) => {
    if (!gameRunning || dropHandled) return;

    dropHandled = true;
    drop.classList.add("collected");
    spawnBurstAtPointer(event, isBadDrop ? "bad" : "good", isBadDrop ? "-" : "+");

    if (isBadDrop) {
      const dirtyPenalty = challengeActive ? currentSettings.challengeDirtyPenalty : currentSettings.dirtyPenalty;
      score -= dirtyPenalty;
      setFeedback(`Dirty drop! -${dirtyPenalty} points`, "bad");
      playSound("dirty");
    } else {
      score += 2;
      setFeedback("Great catch! +2 points", "good");
      playSound("collect");
    }
    updateScore();
    setTimeout(() => drop.remove(), 120);
  });

  // Add the new drop to the game screen
  gameContainer.appendChild(drop);

  // Remove drops that reach the bottom (weren't clicked)
  drop.addEventListener("animationend", () => {
    if (!dropHandled && gameRunning && !isBadDrop) {
      const missPenalty = challengeActive ? currentSettings.challengeMissPenalty : currentSettings.missPenalty;
      score -= missPenalty;
      updateScore();
      setFeedback(`Missed clean drop! -${missPenalty} point${missPenalty > 1 ? "s" : ""}`, "bad");
      playSound("miss");
    }

    dropHandled = true;
    drop.remove(); // Clean up drops that weren't caught
  });
}

function createObstacle() {
  if (!gameRunning || !challengeActive) return;

  const obstacle = document.createElement("div");
  obstacle.className = "trash-obstacle";

  const gameWidth = gameContainer.offsetWidth;
  const obstacleSize = 56;
  const xPosition = Math.random() * (gameWidth - obstacleSize);
  obstacle.style.left = xPosition + "px";
  obstacle.style.animationDuration = `${Math.random() * 1.4 + 2.2}s`;
  obstacle.style.setProperty("--obstacle-fall-distance", `${gameContainer.clientHeight + 40}px`);

  obstacle.addEventListener("click", (event) => {
    if (!gameRunning || !challengeActive) return;

    score -= 4;
    updateScore();
    setFeedback("Hit trash obstacle! -4 points", "bad");
    spawnBurstAtPointer(event, "obstacle-hit", "x");
    playSound("obstacle");
    obstacle.remove();
  });

  obstacle.addEventListener("animationend", () => {
    obstacle.remove();
  });

  gameContainer.appendChild(obstacle);
}

function scheduleChallenge() {
  if (!gameRunning) return;

  const nextChallengeDelay = Math.random() * (currentSettings.challengeDelayMax - currentSettings.challengeDelayMin) + currentSettings.challengeDelayMin;
  challengeTimer = setTimeout(activateChallenge, nextChallengeDelay);
}

function activateChallenge() {
  if (!gameRunning) return;

  challengeActive = true;
  updateChallengeStatus("Pollution Surge", true);
  gameContainer.classList.add("challenge-active");
  setFeedback("Pollution surge! More bad drops and trash obstacles.", "bad");

  obstacleMaker = setInterval(createObstacle, currentSettings.obstacleInterval);
  challengeEndTimer = setTimeout(deactivateChallenge, currentSettings.challengeDuration);
}

function deactivateChallenge() {
  challengeActive = false;
  updateChallengeStatus("Calm", false);
  gameContainer.classList.remove("challenge-active");
  clearInterval(obstacleMaker);
  gameContainer.querySelectorAll(".trash-obstacle").forEach((obstacle) => obstacle.remove());

  if (gameRunning) {
    setFeedback("Waters are calmer. Keep collecting!", "good");
    scheduleChallenge();
  }
}

function updateScore() {
  scoreDisplay.textContent = score;
}

function updateTime() {
  timeDisplay.textContent = timeLeft;
}

function updateGameTimer() {
  timeLeft -= 1;
  updateTime();

  if (timeLeft <= 0) {
    endGame();
  }
}

function endGame() {
  gameRunning = false;
  clearInterval(dropMaker);
  clearInterval(timerTick);
  clearInterval(obstacleMaker);
  clearTimeout(challengeTimer);
  clearTimeout(challengeEndTimer);
  challengeActive = false;
  updateChallengeStatus("Calm", false);
  gameContainer.classList.remove("challenge-active");
  gameContainer.innerHTML = "";
  startButton.textContent = "Start Game";
  difficultySelect.disabled = false;

  if (score >= currentSettings.targetScore) {
    launchCelebration();
    setFeedback(`${pickRandomMessage(winningMessages)} Final score: ${score}`, "good");
    playSound("win");
  } else {
    clearCelebration();
    setFeedback(`${pickRandomMessage(losingMessages)} Final score: ${score}`, "bad");
  }
}

function resetGame() {
  gameRunning = false;
  clearInterval(dropMaker);
  clearInterval(timerTick);
  clearInterval(obstacleMaker);
  clearTimeout(challengeTimer);
  clearTimeout(challengeEndTimer);
  clearTimeout(celebrationTimeout);

  challengeActive = false;
  score = 0;
  timeLeft = currentSettings.timeLimit;

  updateScore();
  updateTime();
  updateChallengeStatus("Calm", false);

  gameContainer.classList.remove("challenge-active");
  gameContainer.innerHTML = "";
  startButton.textContent = "Start Game";
  difficultySelect.disabled = false;
  clearCelebration();
  updateTargetScoreDisplay();
  setFeedback("Game reset. Press Start Game to play.", "good");
}

function launchCelebration() {
  const confettiColors = ["#ffc907", "#2e9df7", "#4fcb53", "#f5402c", "#ff902a"];

  clearCelebration();
  celebrationOverlay.classList.add("show");

  const text = document.createElement("div");
  text.className = "celebration-text";
  text.textContent = "Clean Water Champion!";
  celebrationOverlay.appendChild(text);

  for (let i = 0; i < 80; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    piece.style.animationDuration = `${Math.random() * 1.6 + 1.7}s`;
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    celebrationOverlay.appendChild(piece);
  }

  clearTimeout(celebrationTimeout);
  celebrationTimeout = setTimeout(clearCelebration, 2600);
}

function clearCelebration() {
  celebrationOverlay.classList.remove("show");
  celebrationOverlay.innerHTML = "";
}

function pickRandomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

function updateChallengeStatus(label, isDanger) {
  challengeStatusDisplay.textContent = label;
  challengeStatusDisplay.classList.toggle("danger", isDanger);
}

function updateTargetScoreDisplay() {
  targetScoreDisplay.textContent = currentSettings.targetScore;
}

function initAudio() {
  if (audioContext) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playSound(type) {
  if (!audioContext) return;

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  const now = audioContext.currentTime;
  const masterGain = audioContext.createGain();
  masterGain.gain.value = 0.12;
  masterGain.connect(audioContext.destination);

  const playTone = (frequency, startTime, duration, waveType = "sine", gainValue = 0.5) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
  };

  if (type === "collect") {
    playTone(660, now, 0.09, "triangle", 0.5);
    playTone(990, now + 0.06, 0.11, "triangle", 0.42);
  } else if (type === "miss") {
    playTone(220, now, 0.14, "sine", 0.45);
    playTone(160, now + 0.08, 0.16, "sine", 0.34);
  } else if (type === "win") {
    playTone(523.25, now, 0.11, "triangle", 0.45);
    playTone(659.25, now + 0.1, 0.11, "triangle", 0.45);
    playTone(783.99, now + 0.2, 0.14, "triangle", 0.5);
  } else if (type === "dirty") {
    playTone(180, now, 0.1, "square", 0.34);
    playTone(110, now + 0.06, 0.14, "square", 0.26);
  } else if (type === "obstacle") {
    playTone(300, now, 0.08, "triangle", 0.32);
    playTone(140, now + 0.04, 0.12, "triangle", 0.24);
  }

  setTimeout(() => {
    masterGain.disconnect();
  }, 500);
}

function spawnBurstAtPointer(event, className, symbol) {
  const burst = document.createElement("div");
  burst.className = `drop-burst ${className}`;

  burst.style.left = `${event.clientX}px`;
  burst.style.top = `${event.clientY}px`;
  burst.textContent = symbol;
  document.body.appendChild(burst);
  burst.addEventListener("animationend", () => burst.remove());
}

function setFeedback(message, type) {
  feedbackText.textContent = message;
  feedbackDisplay.classList.remove("good", "bad");

  if (type) {
    feedbackDisplay.classList.add(type);
  }
}
