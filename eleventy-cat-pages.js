#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import logger from 'cli-logger';
var log = logger();
const APP_NAME = '\nEleventy Category File Generator';
const APP_AUTHOR = 'by John M. Wargo (https://johnwargo.com)';
const APP_CONFIG_FILE = '11ty-cat-pages.json';
const DATA_FILE = 'category-meta.json';
const ELEVENTY_CONFIG_FILE = '.eleventy.js';
const TEMPLATE_FILE = '11ty-cat-pages.liquid';
const UNCATEGORIZED_STRING = 'Uncategorized';
const pattern = /(^-{3}(?:\r\n|\r|\n)([\w\W]*?)-{3}(?:\r\n|\r|\n))?([\w\W]*)*/;
var categories = [];
var fileList = [];
function compareFunction(a, b) {
    if (a.category < b.category) {
        return -1;
    }
    if (a.category > b.category) {
        return 1;
    }
    return 0;
}
async function validateConfig(validations) {
    var processResult;
    processResult = {
        result: true, message: 'Configuration file errors:\n'
    };
    for (var validation of validations) {
        log.debug(`Validating '${validation.filePath}'`);
        if (validation.isFolder) {
            if (!directoryExists(validation.filePath)) {
                processResult.result = false;
                processResult.message += `\nThe '${validation.filePath}' folder is required, but does not exist.`;
            }
        }
        else {
            if (!fs.existsSync(validation.filePath)) {
                processResult.result = false;
                processResult.message += `\nThe '${validation.filePath}' file is required, but does not exist.`;
            }
        }
    }
    return processResult;
}
function getAllFiles(dirPath, arrayOfFiles) {
    var files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        }
        else {
            arrayOfFiles.push(path.join(process.cwd(), dirPath, file));
        }
    });
    return arrayOfFiles;
}
function getFileList(filePath, debugMode) {
    if (debugMode)
        console.log();
    log.info('Building file list...');
    log.debug(`filePath: ${filePath}`);
    return getAllFiles(filePath, []);
}
function buildCategoryList(categories, fileList, debugMode) {
    if (debugMode)
        console.log();
    log.info('Building category list...');
    for (var fileName of fileList) {
        log.debug(`Parsing ${fileName}`);
        var postFile = fs.readFileSync(fileName.toString(), 'utf8');
        var content = JSON.parse(JSON.stringify(YAML.parseAllDocuments(postFile, { logLevel: 'silent' })));
        if (content[0].categories) {
            var categoriesString = content[0].categories.toString();
        }
        else {
            categoriesString = UNCATEGORIZED_STRING;
        }
        var catArray = categoriesString.split(',');
        for (var cat of catArray) {
            var category = cat.trim();
            var index = categories.findIndex((item) => item.category === category);
            if (index < 0) {
                log.info(`Found category: ${category}`);
                categories.push({ category: category, count: 1, description: '' });
            }
            else {
                categories[index].count++;
            }
        }
    }
    return categories;
}
function directoryExists(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            return fs.lstatSync(filePath).isDirectory();
        }
        catch (err) {
            log.error(`checkDirectory error: ${err}`);
            return false;
        }
    }
    return false;
}
function findFilePath(endPath, thePaths) {
    let resStr = path.join(thePaths[thePaths.length - 1], endPath);
    for (var tmpPath of thePaths) {
        let destPath = path.join(tmpPath, endPath);
        log.debug(`Checking ${destPath}`);
        if (directoryExists(destPath)) {
            resStr = destPath;
            break;
        }
    }
    return resStr;
}
function buildConfigObject() {
    const theFolders = ['.', 'src'];
    const dataFolder = findFilePath('_data', theFolders);
    return {
        categoriesFolder: findFilePath('categories', theFolders),
        dataFileName: path.join(dataFolder, DATA_FILE),
        dataFolder: dataFolder,
        postsFolder: findFilePath('posts', theFolders),
        templateFileName: TEMPLATE_FILE
    };
}
console.log(APP_NAME);
console.log(APP_AUTHOR);
const myArgs = process.argv.slice(2);
const debugMode = myArgs.includes('-d');
log.level(debugMode ? log.DEBUG : log.INFO);
log.debug('Debug mode enabled\n');
log.debug(`cwd: ${process.cwd()}`);
let tmpFile = path.join(process.cwd(), ELEVENTY_CONFIG_FILE);
log.info('Validating project folder');
if (!fs.existsSync(tmpFile)) {
    log.error(`Current folder is not an Eleventy project folder. Unable to locate the '${ELEVENTY_CONFIG_FILE}' file.`);
    process.exit(1);
}
log.debug('Project is an Eleventy project folder');
const configFile = path.join(process.cwd(), APP_CONFIG_FILE);
log.info('Locating configuration file');
if (!fs.existsSync(configFile)) {
    log.info(`Configuration file '${APP_CONFIG_FILE}' not found, creating...`);
    let configObject = buildConfigObject();
    if (debugMode)
        console.dir(configObject);
    let outputStr = JSON.stringify(configObject, null, 2);
    outputStr = outputStr.replace(/\\/g, '/');
    log.info(`Writing configuration file ${APP_CONFIG_FILE}`);
    try {
        fs.writeFileSync(path.join('.', APP_CONFIG_FILE), outputStr, 'utf8');
        log.info('Output file written successfully');
    }
    catch (err) {
        log.error(`Unable to write to ${APP_CONFIG_FILE}`);
        console.dir(err);
        process.exit(1);
    }
    process.exit(0);
}
log.info('Configuration file located, validating');
const configFilePath = path.join(process.cwd(), APP_CONFIG_FILE);
if (!fs.existsSync(configFilePath)) {
    log.error(`Unable to locate the configuration file '${APP_CONFIG_FILE}'`);
    process.exit(1);
}
let configData = fs.readFileSync(configFilePath, 'utf8');
const configObject = JSON.parse(configData);
const validations = [
    { filePath: configObject.categoriesFolder, isFolder: true },
    { filePath: configObject.dataFolder, isFolder: true },
    { filePath: configObject.postsFolder, isFolder: true },
    { filePath: configObject.templateFileName, isFolder: false }
];
validateConfig(validations)
    .then((res) => {
    if (res.result) {
        log.info(`Reading template file ${configObject.templateFileName}`);
        let templateFile = fs.readFileSync(configObject.templateFileName, 'utf8');
        let templateDoc = YAML.parseAllDocuments(templateFile, { logLevel: 'silent' });
        let frontmatter = JSON.parse(JSON.stringify(templateDoc))[0];
        if (debugMode)
            console.dir(frontmatter);
        let categories = [];
        let categoryFile = path.join(process.cwd(), configObject.dataFileName);
        if (fs.existsSync(categoryFile)) {
            log.info(`Reading existing categories file ${configObject.dataFileName}`);
            let categoryData = fs.readFileSync(categoryFile, 'utf8');
            categories = JSON.parse(categoryData);
            if (categories.length > 0)
                categories.forEach((item) => item.count = 0);
            if (debugMode)
                console.table(categories);
        }
        else {
            log.info('Category data file not found, will create a new one');
        }
        fileList = getFileList(configObject.postsFolder, debugMode);
        if (fileList.length < 1) {
            log.error('\nNo Post files found in the project, exiting');
            process.exit(0);
        }
        log.info(`Located ${fileList.length} files`);
        if (debugMode)
            console.dir(fileList);
        categories = buildCategoryList(categories, fileList, debugMode);
        if (categories.length > 0) {
            log.info('Deleting unused categories (from previous runs)');
            categories = categories.filter((item) => item.count > 0);
        }
        log.info(`Identified ${categories.length} categories`);
        categories = categories.sort(compareFunction);
        if (debugMode)
            console.table(categories);
        var outputPath = path.join(process.cwd(), configObject.dataFileName);
        log.info(`Writing categories list to ${outputPath}`);
        try {
            fs.writeFileSync(outputPath, JSON.stringify(categories, null, 2), 'utf8');
        }
        catch (err) {
            console.log('Error writing file');
            console.error(err);
            process.exit(1);
        }
        const categoriesFolder = path.join(process.cwd(), configObject.categoriesFolder);
        log.debug(`Emptying categories folder: ${categoriesFolder}`);
        fs.emptyDirSync(categoriesFolder);
        categories.forEach(function (item) {
            if (item.category === "")
                return;
            frontmatter.pagination.before = `function(paginationData, fullData){ return paginationData.filter((item) => item.categories.includes("${item.category}"));}`;
            console.log(templateFile);
            templateFile = templateFile.replace(pattern, YAML.stringify(frontmatter));
            console.log(templateFile);
            let catPage = path.join(categoriesFolder, item.category.toLowerCase().replace(' ', '-') + ".md");
            log.debug(`Writing category page: ${catPage}`);
            fs.writeFileSync(catPage, templateFile);
        });
    }
    else {
        log.error(res.message);
        process.exit(1);
    }
})
    .catch((err) => {
    log.error(err);
    process.exit(1);
});
