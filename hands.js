let video = document.getElementById('input_video');
let canvas = document.getElementById('output_canvas');
let ctx = canvas.getContext('2d');
let fingerCountElement = document.getElementById('finger-count');
let progressBarElement = document.getElementById('progress-bar');
let resultOverlay = document.getElementById('result-overlay');
let resultMessage = document.getElementById('result-message');
let nextButton = document.getElementById('next-button');

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.1/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    minDetectionConfidence: 0.8,
    minTrackingConfidence: 0.5
});

let questions = [
    {
        question: "What is the height in an HD Image?",
        choices: ["480", "720", "1080", "240"],
        answer: 1
    },
    {
        question: "How many corners does a hexagon have?",
        choices: ["Three", "Four", "Five", "Six"],
        answer: 3
    },
    {
        question: "What is the variable type of a? a = 'yes'",
        choices: ["Integer", "Float", "String", "Character"],
        answer: 2
    },
    {
        question: "How many oceans are in the world?",
        choices: ["Two", "Three", "Four", "Five"],
        answer: 3
    }
];

let currentQuestionIndex = 0;
let selectionStartTime = null;
const selectionThreshold = 3000; // 3 seconds


async function onOpenCvReady() {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        video.srcObject = stream;
    });

    const camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
        width: 640,
        height: 480
    });

    camera.start();
}

function drawQuestion(question) {
    let container = document.getElementById('question-container');
    container.innerHTML = `<p class="title">${question.question}</p>`;
    question.choices.forEach((choice, index) => {
        container.innerHTML += `<p class="subtitle choice" id="choice-${index}">${choice}</p>`;
    });
}

function countExtendedFingers(landmarks) {
    const tips = [8, 12, 16, 20];
    let count = 0;
    for (let tip of tips) {
        let mcp = tip - 2;
        if (landmarks[tip].y < landmarks[mcp].y) { // for simplicity assuming y decreases upwards
            count++;
        }
    }
    return count;
}

function updateProgressBar() {
    let progress = (currentQuestionIndex / questions.length) * 100;
    progressBarElement.style.width = `${progress}%`;
}

function showResult(isCorrect, correctAnswer) {
    resultOverlay.style.display = 'block';
    if (isCorrect) {
        resultOverlay.classList.add('correct');
        resultOverlay.classList.remove('incorrect');
        resultMessage.textContent = `Correct!`;
    } else {
        resultOverlay.classList.add('incorrect');
        resultOverlay.classList.remove('correct');
        resultMessage.textContent = `Incorrect! The correct answer was: ${correctAnswer}`;
    }
}

function hideResult() {
    resultOverlay.style.display = 'none';
}

nextButton.addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        drawQuestion(questions[currentQuestionIndex]);
        updateProgressBar();
        hideResult();
    } else {
        document.getElementById('question-container').innerHTML = '<p class="title">Quiz Completed</p>';
        updateProgressBar();
        hideResult();
    }
});

function onResults(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    if (results.multiHandLandmarks) {
        for (let landmarks of results.multiHandLandmarks) {
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2 });

            let fingerCount = countExtendedFingers(landmarks);
            fingerCountElement.textContent = fingerCount;
            let now = Date.now();

            if (fingerCount > 0 && fingerCount <= 4) {
                if (!selectionStartTime) {
                    selectionStartTime = now;
                } else if (now - selectionStartTime > selectionThreshold) {
                    let isCorrect = (fingerCount - 1 === questions[currentQuestionIndex].answer);
                    let correctAnswer = questions[currentQuestionIndex].choices[questions[currentQuestionIndex].answer];
                    showResult(isCorrect, correctAnswer);

                    selectionStartTime = null;
                }
            } else {
                selectionStartTime = null;
            }
        }
    }
}

hands.onResults(onResults);

window.onload = function () {
    drawQuestion(questions[currentQuestionIndex]);
}
