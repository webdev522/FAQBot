// Library to provide natual language processing and
// basic machine learning cabailities
const NLP = require('natural');

// Provides a wrapper around the Slack API to easily
// interact with the chat service
const BotKit = require('botkit');

// Built-in Node library for loading files operations
const fs = require('fs');

// Load our environment variables from the .env file
require('dotenv').config();

// Create a new classifier to train
const classifier = new NLP.LogisticRegressionClassifier();

// What are the types of chats we want to consider
// In this case, we only care about chats that come directly to the bot
const scopes = [
    'direct_mention',
    'direct_message',
    'mention'
];

// Get our Slack API token from the environment
const token = process.env.SLACK_API_TOKEN;

// Create a chatbot template that can be instantiated using Botkit
const Bot = BotKit.slackbot({
    debug: false,
    storage: undefined
});

/**
 * Function to easily parse a given json file to a JavaScript Object
 * 
 * @param {String} filePath 
 * @returns {Object} Object parsed from json file provided
 */
function parseTrainingData(filePath) {
    const trainingFile = fs.readFileSync('./trainingData.json');
    return JSON.parse(trainingFile);
}

/**
 * Will add the phrases to the provided classifier under the given label.
 * 
 * @param {Classifier} classifier
 * @param {String} label
 * @param {Array.String} phrases
 */
function trainClassifier(classifier, label, phrases) {
    console.log('Teaching set', label, phrases);
    phrases.forEach((phrase) => {
        console.log(`Teaching single ${label}: ${phrase}`);
        classifier.addDocument(phrase.toLowerCase(), label);
    });
}

/**
 * Uses the trained classifier to give a prediction of what
 * labels the provided pharse belongs to with a confidence
 * value associated with each and a a guess of what the actual
 * label should be based on the minConfidence threshold.
 * 
 * @param {String} phrase 
 * 
 * @returns {Object}
 */
function interpret(phrase) {
    console.log('interpret', phrase);
    const guesses = classifier.getClassifications(phrase.toLowerCase());
    console.log('guesses', guesses);
    const guess = guesses.reduce((x, y) => x && x.value > y.value ? x : y);
    return {
        probabilities: guesses,
        guess: guess.value > (0.7) ? guess.label : null
    };
}



/**
 * Callback function for BotKit to call. Provided are the speech
 * object to reply and the message that was provided as input.
 * Function will take the input message, attempt to label it 
 * using the trained classifier, and return the corresponding
 * answer from the training data set. If no label can be matched
 * with the set confidence interval, it will respond back saying
 * the message was not able to be understood.
 * 
 * @param {Object} speech 
 * @param {Object} message 
 */
function handleMessage(speech, message) {
    const interpretation = interpret(message.text);
    console.log('InternChatBot heard: ', message.text);
    console.log('InternChatBot interpretation: ', interpretation);

    if (interpretation.guess && trainingData[interpretation.guess]) {
        console.log('Found response');
        speech.reply(message, trainingData[interpretation.guess].answer);
    } else {
        console.log('Couldn\'t match phrase')
        speech.reply(message, 'Sorry, I\'m not sure what you mean');
    }
}

// Load our training data
const trainingData = parseTrainingData("./trainingData.json");

// For each of the labels in our training data,
// train and generate the classifier
var i = 0;
Object.keys(trainingData).forEach((element, key) => {
    trainClassifier(classifier, element, trainingData[element].questions);
    i++;
    if (i === Object.keys(trainingData).length) {
        classifier.train();
        const filePath = './classifier.json';
        classifier.save(filePath, (err, classifier) => {
            if (err) {
                console.error(err);
            }
            console.log('Created a Classifier file in ', filePath);
        });
    }
});



// Configure the bot
// .* means match any message test
// The scopes we pass determine which kinds of messages we consider (in this case only direct message or mentions)
// handleMessage is the function that will run when the bot matches a message based on the text and scope criteria
Bot.hears('.*', scopes, handleMessage);

// Instantiate a chatbot using the previously defined template and API token
// Open a connection to Slack's real time API to start messaging
Bot.spawn({
    token: token
}).startRTM();


