/* - - Variables - - */

// Canvas size (insta 4/5)
let width = 720; // canvas width
let height = 900; // canvas height

// adjust size to parent div
let parentDiv = document.getElementById('sketch');

let cols = 100; // how many columns?
let rows = 50; // how many rows?
let currentCell = 0; // current cell index

let colWidths = [];
let rowHeights = [];

// Fisheye parameters
let maxSize = 100; // maximum size of a column/row
let minSize = 4; // minimum size of a column/row
let falloffFactor = 10.0; // controls how fast the fisheye drops off

let easing = 0.07; // lower = smoother

let source; // webcam image

// webcam variables
let capture; // our webcam
let captureEvent; // callback when webcam is ready

// lerping (i.e. smoothing the landmarks)
let lerpRate = 0.2; // smaller = smoother, but slower to react
let madeClone = false;
let lerpLandmarks;
let lastKnownLandmarks = null; // fallback points

// function preload() {
//   source = loadImage("source.jpg");
// }

/* - - Setup - - */
function setup() {
  // create canvas inside div
  let canvas = createCanvas(width, height);

  // set our CSS values to parent
  parentDiv.style.aspectRatio = width + ' / ' + height;
  parentDiv.style.width =
    'min(100vw - 40px, calc((100vh - 40px) * (' +
    width +
    ' / ' +
    height +
    ')))';

  canvas.parent(parentDiv);

  noCursor();

  captureWebcam(); // launch webcam

  // typo
  textAlign(CENTER, CENTER);

  // images
  //imageMode(CENTER);

  // Initialize arrays
  for (let i = 0; i < cols; i++) colWidths[i] = width / cols;
  for (let i = 0; i < rows; i++) rowHeights[i] = height / rows;

  // Webcam aktivieren
  source = createCapture(VIDEO);
  source.size(720, 900); // gleiche Größe wie Canvas für einfache Zuordnung
  source.hide(); // verhindert Doppelanzeige
}

/* - - Draw - - */
function draw() {
  background('lightgrey');

  /* TRACKING */
  if (mediaPipe.landmarks[0]) {
    // is tracking ready?

    // clone the landmarks array for lerping
    if (!madeClone) {
      lerpLandmarks = JSON.parse(JSON.stringify(mediaPipe.landmarks));
      madeClone = true;
    }

    // lerp the landmarks
    for (let i = 0; i < mediaPipe.landmarks[0].length; i++) {
      lerpLandmarks[0][i].x = lerp(
        lerpLandmarks[0][i].x,
        mediaPipe.landmarks[0][i].x,
        lerpRate
      );
      lerpLandmarks[0][i].y = lerp(
        lerpLandmarks[0][i].y,
        mediaPipe.landmarks[0][i].y,
        lerpRate
      );
    }

    // Update last known positions
    lastKnownLandmarks = JSON.parse(JSON.stringify(lerpLandmarks));
  } else if (lastKnownLandmarks) {
    // Use last known landmarks if tracking is lost
    lerpLandmarks = JSON.parse(JSON.stringify(lastKnownLandmarks));
  }

  if (lerpLandmarks && lerpLandmarks[0]) {
    // Use the landmarks, either current or last known

    // index finger
    let indexX = map(lerpLandmarks[0][8].x, 0, 1, 0, capture.scaledWidth); // NOT reversed
    let indexY = map(lerpLandmarks[0][8].y, 0, 1, 0, capture.scaledHeight);

    // mirror X manually
    indexX = capture.scaledWidth - indexX;

    // center offset
    indexX += width / 2 - capture.scaledWidth / 2;
    indexY += height / 2 - capture.scaledHeight / 2;

    // --- Calculate column target widths ---
    let colWeights = [];
    let totalColWeight = 0;

    for (let c = 0; c < cols; c++) {
      let colCenter = (c + 0.5) * (width / cols);
      let normDist = abs(indexX - colCenter) / (width / 2);
      let weight = maxSize * pow(1 - constrain(normDist, 0, 1), falloffFactor);
      weight = constrain(weight, minSize, maxSize);
      colWeights.push(weight);
      totalColWeight += weight;
    }

    let colScale = width / totalColWeight;
    for (let c = 0; c < cols; c++) {
      let target = colWeights[c] * colScale;
      colWidths[c] = lerp(colWidths[c], target, easing);
    }

    // --- Calculate row target heights ---
    let rowWeights = [];
    let totalRowWeight = 0;

    for (let r = 0; r < rows; r++) {
      let rowCenter = (r + 0.5) * (height / rows);
      let normDist = abs(indexY - rowCenter) / (height / 2);
      let weight = maxSize * pow(1 - constrain(normDist, 0, 1), falloffFactor);
      weight = constrain(weight, minSize, maxSize);
      rowWeights.push(weight);
      totalRowWeight += weight;
    }

    let rowScale = height / totalRowWeight;
    for (let r = 0; r < rows; r++) {
      let target = rowWeights[r] * rowScale;
      rowHeights[r] = lerp(rowHeights[r], target, easing);
    }

    // --- Draw the smoothed grid ---
    let y = 0;
    for (let r = 0; r < rows; r++) {
      let x = 0;
      for (let c = 0; c < cols; c++) {
        // pick either colWidths or rowHeights (depending on which is smaller)
        let cellSize = min(colWidths[c], rowHeights[r]);

        //  rectangle
        fill(255);
        stroke('white');
        strokeWeight(2);
        //rect(x, y, colWidths[c], rowHeights[r]);

        // // text
        // fill(255);
        // noStroke();
        // textSize(12);
        // text("A", x + colWidths[c] / 2, y + rowHeights[r] / 2);

        // image
        // image(
        //   source,
        //   x + colWidths[c] * 0.5,
        //   y + rowHeights[r] * 0.5,
        //   cellSize * 0.8,
        //   cellSize * 0.8
        // );

        // horizontally mirrored source coords
        let sx = (cols - 1 - c) * (capture.width / cols);
        let sy = r * (capture.height / rows);
        let sWidth = capture.width / cols;
        let sHeight = capture.height / rows;

        // destination on canvas
        let dx = x;
        let dy = y;
        let dWidth = colWidths[c];
        let dHeight = rowHeights[r];

        // draw mirrored slice
        image(capture, dx, dy, dWidth, dHeight, sx, sy, sWidth, sHeight);

        x += colWidths[c];
      }
      y += rowHeights[r];
    }

    // draw index finger
    push();
    centerOurStuff();
    fill('white');
    //ellipse(indexX, indexY, 20);
    pop();
  }
}

/* - - Helper functions - - */

// function: launch webcam
function captureWebcam() {
  capture = createCapture(
    {
      audio: false,
      video: {
        facingMode: 'user',
      },
    },
    function (e) {
      captureEvent = e;
      console.log(captureEvent.getTracks()[0].getSettings());
      // do things when video ready
      // until then, the video element will have no dimensions, or default 640x480
      capture.srcObject = e;

      setCameraDimensions(capture);
      mediaPipe.predictWebcam(capture);
      //mediaPipe.predictWebcam(parentDiv);
    }
  );
  capture.elt.setAttribute('playsinline', '');
  capture.hide();
}

// function: resize webcam depending on orientation
function setCameraDimensions(video) {
  const vidAspectRatio = video.width / video.height; // aspect ratio of the video
  const canvasAspectRatio = width / height; // aspect ratio of the canvas

  if (vidAspectRatio > canvasAspectRatio) {
    // Image is wider than canvas aspect ratio
    video.scaledHeight = height;
    video.scaledWidth = video.scaledHeight * vidAspectRatio;
  } else {
    // Image is taller than canvas aspect ratio
    video.scaledWidth = width;
    video.scaledHeight = video.scaledWidth / vidAspectRatio;
  }
}

// function: center our stuff
function centerOurStuff() {
  translate(
    width / 2 - capture.scaledWidth / 2,
    height / 2 - capture.scaledHeight / 2
  ); // center the webcam
}
