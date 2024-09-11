const puppeteer = require('puppeteer');
const csv = require('csv-parser');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

async function processCSV(csvFilePath, outputFilePath) {
    const browser = await puppeteer.launch();
    const selector = '#key-figures > div > div:nth-child(1) > section:nth-child(2) > div > span';
    const results = [];

    let getElement = async (selector, url) => {
        console.log('getElement');
        const urlPlaceholder = url.slice(-10);
        try {
            // Page setup
            const page = await browser.newPage();
            console.log(`${urlPlaceholder} -- create new page DONE`);
            await page.goto(url);
            console.log(`${urlPlaceholder} -- goto DONE`);
            console.log(`${urlPlaceholder} -- waiting for selector...`);

            // Get page title
            await page.waitForSelector('h1', {timeout: 60000});
            let title = await page.$('h1');
            title = await title.evaluate(el => el.textContent);
            console.log(`${urlPlaceholder} -- title found`, title);

            // Get selector
            const elementHandle = await page.$(selector);

            if (elementHandle) {
                const element = await elementHandle.evaluate((el) => el.ariaLabel);
                console.log(`${urlPlaceholder} -- SUCCESS element found`, element);

                return element;
            } else {
                return 'not found';
            }

        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.error(`Element not found: ${selector} on ${url}`);
                return 'not found';
            } else {
                throw error;
            }
        }
    }

    let updateRow = async (row) => {
        console.log('updateRow', row.Name);
        if (row.url?.length) {
            row.Rating = await getElement(selector, row.url);
        }

        results.push(row);
    }

    try {
        const rows = [];

        fs.createReadStream(csvFilePath)
            .pipe(csv({separator: ';'}))
            .on('data', (row) => {
                rows.push(row);
            })
            .on('end', async () => {
                for (const row of rows) {
                    await updateRow(row);
                    console.log('----------------------------------------------')
                    console.log(`${rows.indexOf(row) + 1} of ${rows.length} done`);
                    console.log('----------------------------------------------')
                }
                await browser.close();

                console.log('----------------------------------------------')
                console.log('All promises done');
                console.log('----------------------------------------------')

                if (results && results.length) {
                    const csvWriter = createCsvWriter({
                        path: outputFilePath,
                        header: [
                            {id: 'Name', title: 'Name'},
                            {id: 'Lopende kosten', title: 'Lopende kosten'},
                            {id: 'Rating', title: 'Rating'},
                            {id: 'Risico', title: 'Risico'},
                            {id: 'Compartiment', title: 'Compartiment'},
                            {id: 'url', title: 'url'}
                        ]
                    });

                    csvWriter
                        .writeRecords(results)
                        .then(async () => {
                            console.log('The data has been successfully appended to file');
                        })
                } else {
                    console.error('Results can not be empty');
                }
            });
    } catch (e) {
        console.error('ERROR', e);
        await browser.close();
    }
}

const inputFilePath = 'keytrade-fondsen/Keytrade fondsen-Keytrade fondsen.csv';
const outputFilePath = `output.csv`;

processCSV(inputFilePath, outputFilePath);
