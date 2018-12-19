const functions = require('firebase-functions');
const {Storage} = require('@google-cloud/storage');
const gcs = new Storage();
const os = require('os');
const path = require('path');
const spawn = require('child-process-promise').spawn;
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.onFileChange = functions.storage.object().onFinalize(object => {
    console.log('testing rename new storage')
    
     const bucket = object.bucket;
   
    console.log(object)
    const contentType = object.contentType;
    const filePath = object.name;
    const fileName = path.basename(filePath);
    console.log('file change detected, function execution started')
    if(object.resourceState === 'not_exists'){
        console.log('We deleted a file, exit...');
        return;
    }

    if(fileName.startsWith('resized-')){
        console.log('We already renamed that file')
        return;
    }
    
    const destBucket = gcs.bucket(bucket)
    const tmpFilePath = path.join(os.tmpdir(), fileName);
    const metadata = {contentType:contentType};
    
    return destBucket.file(filePath).download({
        destination:tmpFilePath
    }).then(()=>{
        return spawn('convert',[tmpFilePath,'-resize','500x500',tmpFilePath]);
       
    }).then(()=>{
        return destBucket.upload(tmpFilePath,{
            destination: 'resized-'+fileName,
            metadata:metadata
        })
    });
});

