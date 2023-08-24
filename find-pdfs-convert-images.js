#!/usr/bin/env node
// ./find-pdfs-convert-images.js ~/Downloads/14.01sc-fall-2011

import * as fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';

async function findPDFsWithGraphs(rootDir) {
  const pdfFiles = [];

  async function findPDFs(dir) {
    const files = await fs.readdir(dir);
    const statPromises = files.map(async file => {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await findPDFs(filePath);
      } else if (stat.isFile() && file.endsWith('.pdf') && file.includes('graph')) {
        pdfFiles.push(filePath);
      }
    });
    await Promise.all(statPromises);
  }

  await findPDFs(rootDir);
  return pdfFiles;
}

async function extractImages(pdfFilePath) {
  const folderName = pdfFilePath.replace('.pdf', '');
  const outputPath = path.join(folderName, '%d.jpg');

  try {
    await fs.mkdir(folderName);
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.error('Error creating directory:', err);
      return;
    }
  }

  try {
    await execAsync(`pdftoppm -jpeg "${pdfFilePath}" "${outputPath}"`);
    // await execAsync(`pdfimages -all "${pdfFilePath}" "${outputPath}"`);
    console.log('Images extracted:', pdfFilePath);
  } catch (err) {
    console.error('Error extracting images:', err);
  }
}

async function main() {
  if (process.argv.length !== 3) {
    console.error('Usage: node find-pdfs-convert-images.js <rootDirectory>');
    process.exit(1);
  }

  const rootDirectory = path.resolve(process.argv[2]);
  const pdfFilesWithGraphs = await findPDFsWithGraphs(rootDirectory);

  const extractPromises = pdfFilesWithGraphs.map(pdfFile => extractImages(pdfFile));
  await Promise.all(extractPromises);
}

main().catch(err => console.error('Error:', err));
