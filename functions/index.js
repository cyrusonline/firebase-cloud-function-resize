const functions = require("firebase-functions");
const { Storage } = require("@google-cloud/storage");

const os = require("os");
const path = require("path");
const spawn = require("child-process-promise").spawn;
const cors = require("cors")({ origin: true });
const Busboy = require("busboy");
const fs = require("fs");
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
const gsconfig = {
  projectID: "cloudfunction-9d075",
  keyFilename: "cloudfunction-9d075-firebase-adminsdk-1y6ae-f6c9e53087.json"
};
const gcs = new Storage(gsconfig);

exports.onFileChange = functions.storage.object().onFinalize(object => {
  console.log("testing rename new storage");

  const bucket = object.bucket;

  console.log(object);
  const contentType = object.contentType;
  const filePath = object.name;
  const fileName = path.basename(filePath);
  console.log("file change detected, function execution started");
  if (object.resourceState === "not_exists") {
    console.log("We deleted a file, exit...");
    return;
  }

  if (fileName.startsWith("resized-")) {
    console.log("We already renamed that file");
    return;
  }

  const destBucket = gcs.bucket(bucket);
  const tmpFilePath = path.join(os.tmpdir(), fileName);
  const metadata = { contentType: contentType };

  return destBucket
    .file(filePath)
    .download({
      destination: tmpFilePath
    })
    .then(() => {
      return spawn("convert", [tmpFilePath, "-resize", "500x500", tmpFilePath]);
    })
    .then(() => {
      return destBucket.upload(tmpFilePath, {
        destination: "resized-" + fileName,
        metadata: metadata
      });
    });
});

exports.uploadFile = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    if (req.method !== "POST") {
      return res.status(500).json({
        message: "Not allowed"
      });
    }
    const busboy = new Busboy({ headers: req.headers });
    let uploadData = null;
    busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
      const filepath = path.join(os.tmpdir(), filename);
      uploadData = { file: filepath, type: mimetype };
      file.pipe(fs.createWriteStream(filepath));
    });
    busboy.on("finish", () => {
      const bucket = gcs.bucket("cloudfunction-9d075.appspot.com");
      bucket
        .upload(uploadData.file, {
          uploadType: "media",
          metadata: {
            metadata: {
              contentType: uploadData.type
            }
          }
        })
        .then((err, uploadedFile) => {
          res.status(200).json({
            message: "It worked!"
          });
        })
        .catch(err => {
          return res.status(500).json({
            error: err
          });
        });
    });
    busboy.end(req.rawBody);
  });
});
