const AWS = require('aws-sdk');
const S3 = new AWS.S3();
const Textract = new AWS.Textract();
const Translate = new AWS.Translate();
const PDFDocument = require('pdfkit');
const streamBuffers = require('stream-buffers');

module.exports.getTranslation = async (event) => {

    const bucketName = event.Records[0].s3.bucket.name;
    const fileName = event.Records[0].s3.object.key;
    console.log("bucketName ======>>>> " + bucketName);
    console.log("fileName ======>>>> " + fileName);
    try {
      console.log("step 1")
        // Get the file from S3
        const file = await S3.getObject({
            Bucket: bucketName,
            Key: fileName
        }).promise();
        console.log("step 2")
        // Detect text using Textract
        const textractParams = {
            Document: {
                Bytes: file.Body
            }
        };
        console.log("step 3")
        const textractData = await Textract.detectDocumentText(textractParams).promise();
        console.log("Textract Response =====>>>> " + JSON.stringify(textractData));
        console.log("step 4")
        let extractedText = '';
        textractData.Blocks.forEach(block => {
            if (block.BlockType === 'LINE') {
                extractedText += block.Text + '\n';
            }
        });
        console.log("step 5")
        // Translate text using Translate
        const translateParams = {
            SourceLanguageCode: 'auto', // Auto-detect the source language
            // TargetLanguageCode: 'es', // Change to the target language code you want
            TargetLanguageCode: 'en', // Change to the target language code you want
            Text: extractedText
        };
        console.log("step 6")
        const translatedData = await Translate.translateText(translateParams).promise();
        const translatedText = translatedData.TranslatedText;
        console.log("Translate Response ======>>>>>> " + translatedText);
        console.log("TYPEOF translatedText ===========>>>>>> " + typeof(translatedText))
        console.log("step 7")
        // Create a new PDF with the translated text
        const pdfDoc = new PDFDocument();
        const writableStreamBuffer = new streamBuffers.WritableStreamBuffer({
            initialSize: (100 * 1024), // start at 100 kilobytes.
            incrementAmount: (10 * 1024) // grow by 10 kilobytes each time buffer overflows.
        });
        console.log("step 8")
        pdfDoc.pipe(writableStreamBuffer);
        pdfDoc.text(translatedText);
        pdfDoc.end();
        console.log("step 9")

        await new Promise(resolve => {
          pdfDoc.on('end', resolve);
        });
        console.log("PDF Created Sucessfully!");
        console.log("TYPEOF PDF ======>>>>> " + typeof(pdfDoc))
        // Upload the new PDF to S3
        const uploadParams = {
            Bucket: process.env.TRANSLATION_BUCKET_NAME,
            Key: `translated-${fileName}`,
            Body: writableStreamBuffer.getContents(),
            ContentType: 'application/pdf'
        };
        console.log("step 10")
        await S3.putObject(uploadParams).promise();
        console.log("step 11")
        return {
            statusCode: 200,
            body: JSON.stringify('File processed successfully')
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify('Error processing file')
        };
    }
};
