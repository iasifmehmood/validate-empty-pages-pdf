const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const pdfPoppler = require('pdf-poppler');
const Jimp = require('jimp');
const { Poppler } = require('node-poppler');

//for mac:
//brew install poppler
// const poppler = new Poppler("/usr/bin");

//for linux:

//sudo apt-get install poppler-data
// sudo apt-get install poppler-utils
// const poppler = new Poppler("/usr/bin");

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true); // Allow any origin
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true, // Enable cookies to be sent with requests from the client
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

const port = 3000;

// Define storage using multer.diskStorage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let path = './';
    fs.mkdirSync(path, { recursive: true }); // Create the directory if it doesn't exist
    cb(null, path);
  },
  filename: (req, file, cb) => {
    cb(null, 'existing.pdf');
  },
});
const upload = multer({ storage: storage });

async function checkImagesForObjects() {
  try {
    console.log('will return objects');
    const outputDir = './output/';

    const promises = fs.readdirSync(outputDir).map(file => {
      const imagePath = path.join(outputDir, file);

      return new Promise((resolve, reject) => {
        // Load the JPG image and convert it to grayscale
        Jimp.read(imagePath, (err, image) => {
          if (err) {
            console.error(`Error reading image ${file}:`, err);
            reject(err);
            return;
          }

          image.greyscale(); // Convert to grayscale

          const width = image.bitmap.width;
          const height = image.bitmap.height;

          // Create a 2D array to store the pixel data (0 for background, 1 for objects)
          const binaryImage = [];

          for (let y = 0; y < height; y++) {
            binaryImage[y] = [];
            for (let x = 0; x < width; x++) {
              const pixelColor = Jimp.intToRGBA(image.getPixelColor(x, y));
              const isObject =
                pixelColor.r < 128 && pixelColor.g < 128 && pixelColor.b < 128;
              binaryImage[y][x] = isObject ? 1 : 0;
            }
          }

          // Function to perform 8-connectivity labeling
          function labelObjects(image) {
            const labels = [];
            const width = image[0].length;
            const height = image.length;
            let currentLabel = 1;

            // Initialize the labels matrix with zeros
            for (let i = 0; i < height; i++) {
              labels[i] = new Array(width).fill(0);
            }

            // Define 8-connectivity neighbors
            const neighbors = [
              [-1, -1],
              [-1, 0],
              [-1, 1],
              [0, -1],
              [0, 1],
              [1, -1],
              [1, 0],
              [1, 1],
            ];

            // Label objects
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                if (image[y][x] === 1) {
                  let neighborLabels = [];

                  for (const [dx, dy] of neighbors) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (
                      nx >= 0 &&
                      nx < width &&
                      ny >= 0 &&
                      ny < height &&
                      labels[ny][nx] !== 0
                    ) {
                      neighborLabels.push(labels[ny][nx]);
                    }
                  }

                  if (neighborLabels.length === 0) {
                    if (currentLabel === 2) {
                      // Skip assigning the label and check the next
                      continue;
                    }
                    labels[y][x] = currentLabel;
                    currentLabel++;
                  } else {
                    neighborLabels.sort((a, b) => a - b);
                    labels[y][x] = neighborLabels[0];

                    // Update equivalent labels
                    for (const label of neighborLabels) {
                      if (label !== neighborLabels[0]) {
                        for (let i = 0; i < height; i++) {
                          for (let j = 0; j < width; j++) {
                            if (labels[i][j] === label) {
                              labels[i][j] = neighborLabels[0];
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }

            const objectCount = currentLabel - 1;
            console.log(objectCount);
            resolve(objectCount);
          }

          // Call the labeling function and count the objects
          labelObjects(binaryImage);
        });
      });
    });

    const objectCounts = await Promise.all(promises);

    console.log(objectCounts);

    // Check if any image had objectCount === 0
    if (objectCounts.includes(0)) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

async function convertPdfToImages() {
  const outputDir = 'output/';
  // Clear the output directory before converting
  fs.readdirSync(outputDir).forEach(file => {
    const filePath = path.join(outputDir, file);
    fs.unlinkSync(filePath); // Delete each file in the directory
  });

  const file = 'existing.pdf';
  const poppler = new Poppler();
  const options = {
    pngFile: true,
  };
  const outputFile = `output/test_document.png`;

  const res = await poppler.pdfToCairo(file, outputFile, options);
  console.log(res);
}

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PDF Checker API',
      version: '1.0.0',
      description: 'A simple API to check if a PDF is valid or not',
    },
    servers: [{ url: `http://localhost:${port}` }],
    // servers: [{ url: `http://3.81.145.117:${port}` }],
  },
  apis: ['./index.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /checkpdf:
 *  post:
 *    summary: Check if the uploaded PDF is valid
 *    requestBody:
 *      content:
 *        multipart/form-data:
 *          schema:
 *            type: object
 *            properties:
 *              pdf:
 *                type: string
 *                format: binary
 *                description: PDF file to check
 *    responses:
 *      200:
 *        description: PDF is valid
 *      400:
 *        description: PDF is invalid or no file uploaded
 *      500:
 *        description: Error processing the PDF
 */

app.post('/checkpdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    await convertPdfToImages();

    setTimeout(function () {
      console.log('Waited for 2 seconds');
    }, 2000);

    let objectCount = await checkImagesForObjects(res);
    // objectCount();
    console.log(objectCount);
    if (objectCount) {
      return res.status(500).json({
        message: 'PDF is invalid',
      });
    } else {
      return res.status(500).json({
        message: 'PDF is valid',
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: 'Error processing the PDF or invalid  PDF',
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
