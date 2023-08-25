#!/usr/bin/env node
// ./download-course.js https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011 /home/srghma/Desktop/14-01sc-principles-of-microeconomics-fall-2011/ /home/srghma/Desktop/ocw.tmp/

// find ~/Desktop/14-01sc-principles-of-microeconomics-fall-2011/ -type f -name '*)\.mp4' -delete

// coursename="14-772-development-economics-macroeconomics-spring-2013" && ./download-course.js "https://ocw.mit.edu/courses/$coursename" "$HOME/Desktop/$coursename" "$HOME/Desktop/ocw.tmp/"
// ./find-pdfs-convert-images.js "$HOME/Desktop/$coursename"

// "type": "module",
import * as fsPromises from 'node:fs/promises'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { exec } from 'node:child_process'
import axios from 'axios'
import * as util from 'util'
import { JSDOM } from 'jsdom'
import { mkdirp } from 'mkdirp'
import AdmZip from 'adm-zip'
import { DownloaderHelper } from 'node-downloader-helper'
import PQueue from 'p-queue'
import cliProgress from 'cli-progress'
import sanitize from "sanitize-filename"
import deepEqual from "deep-equal"
import jsondiffpatch from "jsondiffpatch"

// function isInNodeREPL() {
//   return typeof require !== 'undefined' && require('util')._getReplInputSource() !== undefined;
// }

// var deepEqual = require('deep-equal');
// var axios = require('axios')
// var fsPromises = require('node:fs/promises')
// var fs = require('node:fs')
// var path = require('node:path')
// var { exec } = require('node:child_process')
// var util = require('node:util')
// var { JSDOM } = require('jsdom')
// var { mkdirp } = require('mkdirp')
// var AdmZip = require('adm-zip')
// var { DownloaderHelper } = require('node-downloader-helper')
// var { default: PQueue } = await import("p-queue")
// var cliProgress = require('cli-progress')
// var sanitize = require("sanitize-filename")


// https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011
// https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011/
// https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011/download
// https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011/download/
// to
// https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011/download
function addDownloadPath(url) {
  if (!url.endsWith('/download')) {
    if (!url.endsWith('/')) {
      url += '/'
    }
    url += 'download'
  }
  return url
}

var fileExists = filepath => fsPromises.access(filepath).then(() => true).catch(() => false)

async function getPageDocument_fromUrl(url) {
  var response = await axios.get(url)
  var dom = new JSDOM(response.data, { url })
  var document = dom.window.document
  return document
}

async function getPageDocument_fromFile(filepath) {
  var exists = await fileExists(filepath)
  if (!exists) { throw new Error(`getPageDocument_fromFile: file doesnt exist ${filepath}`) }
  const htmlContent = await fsPromises.readFile(filepath, 'utf-8')
  const dom = new JSDOM(htmlContent)
  var document = dom.window.document
  return document
}

function anchorElement_absoluteHref(element) {
  var document = element.ownerDocument
  var window = document.defaultView
  var url = new window.URL(element.href, window.location.href)
  console.log(`element.href`, element.href)
  console.log(`window.location.href`, window.location.href)
  // console.log(`url`, url)
  console.log(`url.toString()`, url.toString())
  return url.toString()
}

function getResourceListItems({ element, downloadModeIsFromCache, extractPath, courseUrl }) {
  var resourceListItems = Array.from(element.querySelectorAll('.resource-list-item'))

  resourceListItems = resourceListItems.map(item => {
    // console.log(item.innerHTML)
    var link = item.querySelector('a[aria-label="Download file"]')
    if (!link) { return null }
    // console.log(link)
    var linkWithName = item.querySelector('a.resource-list-title')
    var textName = linkWithName.textContent.trim()
    // console.log(linkWithName)

    var linkHref = null

    if (downloadModeIsFromCache) {
      try {
        linkHref = anchorElement_absoluteHref(link).trim()
      } catch (e) {
        // TypeError: Invalid URL: ./static_resources/ocw_1404_finalreview_2020dec08_360p_16_9.mp4
        linkHref = link.getAttribute('href').trim()
        var isVideo = linkHref.endsWith('.mp4')
        if (isVideo) {
          var url = new URL(linkHref, courseUrl + '/download')
          console.log(`url.toString()`, url.toString())
          linkHref = url.toString()
        } else {
          linkHref = path.join(extractPath, linkHref)
        }
      }
    } else {
      linkHref = anchorElement_absoluteHref(link).trim()
    }
    // var isLocalPath = !linkHref.startsWith('http')

    // // prevent
    // // link: 'https:/ocw.mit.edu/courses/14-04-intermediate-microeconomic-theory-fall-2020/courses/14-04-intermediate-microeconomic-theory-fall-2020/ocw_1404_lecture02_2020sep03_360p_16_9.mp4',
    // // should be https://ocw.mit.edu/courses/14-04-intermediate-microeconomic-theory-fall-2020/ocw_1404_lecture02_2020sep03_360p_16_9.mp4
    // var isVideo = linkHref.endsWith('.mp4')

    return {
      // link: isLocalPath && !isVideo ? path.join(courseUrlOrExtractPath, linkHref) : linkHref,
      link: linkHref,
      textName,
    }
  }).filter(x => x)

  return resourceListItems
}

// {
//   link: 'http://www.archive.org/download/MIT14.01SCF10/MIT14_01SCF10_problem_3-5_300k.mp4',
//   textName: 'Problem 5 Solution Video'
// }
// => 'Problem 5 Solution Video.mp4'

// {
//   link: 'http://www.archive.org/download/MIT14.01SCF10/MIT14_01SCF10_problem_3-5_300k.mp4',
//   textName: 'Problem 5 Solution Video.webm'
// }
// => 'Problem 5 Solution Video.webm.mp4'

// {
//   link: '/courses/14-01sc-principles-of-microeconomics-fall-2011/246785b93665931deee8867a16cfefd9_MIT14_01SCF11_soln01.pdf',
//   textName: 'MIT14_01SCF11_soln01.myext'
// }
// => 'MIT14_01SCF11_soln01.myext.mp4'

// {
//   link: '/home/srghma/Desktop/ocw.tmp/14.03-fall-2016/static_resources/079b991cbbc1d1a840e19fd08194ea7e_MIT14_03F16_lec8Sugar.pdf',
//   textName: '14.03/14.003 Fall 2016 United States Sugar Program Notes.'
// }
// => '14.03/14.003 Fall 2016 United States Sugar Program Notes..pdf'

function outputFileName({ link, textName }) {
  // on /courses/14-01sc-principles-of-microeconomics-fall-2011/246785b93665931deee8867a16cfefd9_MIT14_01SCF11_soln01.pdf
  // Uncaught TypeError [ERR_INVALID_URL]: Invalid URL
  var dummyBaseUrl = 'http://dummy.org' // A dummy base URL
  var url = new URL(link, dummyBaseUrl)
  var url_extname = path.extname(url.pathname)
  // if name ends with url_extname - do nothing
  // else - add extname
  // Check if name ends with url_extname

  function removeEnding(removeFromThisString, removeThis) {
      if (removeFromThisString.endsWith(removeThis)) {
          return removeFromThisString.slice(0, -removeThis.length)
      } else {
          return removeFromThisString
      }
  }

  textName = textName.trim()
  textName = removeEnding(textName)
  textName = textName.replace(/\//g, '_')
  textName = sanitize(textName)

  if (textName.endsWith(url_extname)) { return textName }
  return textName + url_extname
}

// { link: 'https://my.org/file1', filename: 'outputfile1.mp4' },
// { link: 'https://my.org/file2', filename: 'outputfile2.mp4' },
// { link: 'https://my.org/file3', filename: 'outputfile3.mp4' },
// { link: 'https://my.org/file4', filename: 'outputfile2.mp4' },
// { link: 'https://my.org/file5', filename: 'outputfile2.mp4' }
//
// To
//
// { link: 'https://my.org/file1', filename: 'outputfile1.mp4' },
// { link: 'https://my.org/file2', filename: 'outputfile2.mp4' },
// { link: 'https://my.org/file3', filename: 'outputfile3.mp4' },
// { link: 'https://my.org/file4', filename: 'outputfile2 (1).mp4' },
// { link: 'https://my.org/file5', filename: 'outputfile2 (2).mp4' }
function findAddIndexIfDuplicateFilename(listOfFilenames) {
  var filenameMap = new Map()
  var resultFilenames = []
  for (var element of listOfFilenames) {
    var { filename } = element
    if (!filenameMap.has(filename)) {
      filenameMap.set(filename, 1)
      resultFilenames.push({ ...element, filename })
    } else {
      var index = filenameMap.get(filename)
      var parsed = path.parse(filename)
      var newFilename = `${parsed.name} (${index})${parsed.ext}`
      filenameMap.set(filename, index + 1)
      filenameMap.set(newFilename, 1)
      resultFilenames.push({ ...element, filename: newFilename })
    }
  }
  return resultFilenames
}

async function downloadZipFile(zipUrl, downloadedZipPath) {
  // const dl = new DownloaderHelper(zipUrl, downloadHereDirPath, {
  //   // fileName: filename,
  //   resumeOnIncomplete: true, // will append (1).mp4
  //   resumeIfFileExists: true, // will append (1).mp4
  //   override: { skip: true, skipSmaller: false },
  //   // removeOnStop: false, // remove the file when is stopped (default:true)
  //   removeOnFail: true, // remove the file when fail (default:true)
  //   retry: { maxRetries: 3, delay: 3000 }, // { maxRetries: number, delay: number in ms } or false to disable (default)
  // })
  // dl.on('skip', onSkip)
  // dl.on('download', onDownload)
  // dl.on('progress.throttled', onProgressThrottled)
  // return dl.start()

  const response = await axios.get(zipUrl, { responseType: 'stream' })
  const outputStream = fs.createWriteStream(downloadedZipPath)
  response.data.pipe(outputStream)
  return new Promise((resolve, reject) => {
    outputStream.on('finish', resolve)
    outputStream.on('error', reject)
  })
}

async function downloadZip(courseUrl, cachePath) {
  var indexPage = await getPageDocument_fromUrl(path.join(courseUrl, '/download'))
  var zipUrl = anchorElement_absoluteHref(indexPage.querySelector('.download-course-button'))
  var zipFilenameWithExt = path.basename(zipUrl)
  var { name: zipFilenameWithoutExt } = path.parse(zipFilenameWithExt)
  var downloadedZipPath = path.join(cachePath, zipFilenameWithExt)
  var extractPath = path.join(cachePath, zipFilenameWithoutExt)

  try {
    var isDownloaded = await fileExists(downloadedZipPath)
    if (!isDownloaded) {
      await downloadZipFile(zipUrl, downloadedZipPath)
      console.log('ZIP file downloaded:', zipUrl, 'to', downloadedZipPath)
    }
    var isExtracted = await fileExists(extractPath)
    if (!isExtracted) {
      // Extract the ZIP contents
      var zip = new AdmZip(downloadedZipPath)
      zip.extractAllTo(extractPath, true)
      console.log('ZIP contents extracted:', downloadedZipPath, 'to', extractPath)
    }
  } catch (err) {
    console.error('Error:', err)
  }
  return extractPath
}

async function getIndexPageLinks({ downloadModeIsFromCache, extractPath, courseUrl }) {
  // var downloadModeIsRemote = null
  // switch (inputString) {
  // case "remote": downloadModeIsRemote = true; break;
  // case "from-cache": console.log("Case 2 matched."); break;
  // default: throw new Error('wrong')
  // }
  // var downloadModeIsFromCache = !courseUrlOrExtractPath.startsWith('http')

  var indexPagePathOrUrl = downloadModeIsFromCache ? path.join(extractPath, '/download/index.html') : await addDownloadPath(courseUrl, '/download')
  var indexPage = downloadModeIsFromCache ? await getPageDocument_fromFile(indexPagePathOrUrl) : await getPageDocument_fromUrl(indexPagePathOrUrl)

  // console.log(indexPage.innerHTML)
  var resourceList = Array.from(indexPage.querySelectorAll('.resource-list')).filter(x => x.innerHTML.trim().length > 0)

  resourceList = resourceList.map(resource => {
    // resource = resourceList[0]
    var heading = resource.querySelector('h4').textContent
    var seeAllLink = resource.querySelector('.float-right a')
    var seeAllLinkHref = seeAllLink ? (downloadModeIsFromCache ? seeAllLink.href : anchorElement_absoluteHref(seeAllLink)) : null
    var resourceListItems = getResourceListItems({ element: resource, downloadModeIsFromCache, extractPath, courseUrl })
    return {
      heading,
      seeAllLinkHref,
      resourceListItems,
    }
  })

  resourceList = await Promise.all(resourceList.map(async (resource) => {
    if (!resource.seeAllLinkHref) { return resource }
    var page = downloadModeIsFromCache ? await getPageDocument_fromFile(path.join(extractPath, 'download', resource.seeAllLinkHref, 'index.html')) : await getPageDocument_fromUrl(resource.seeAllLinkHref)
    var resourceListItems_new = getResourceListItems({ element: page, downloadModeIsFromCache, extractPath, courseUrl })
    return { ...resource, resourceListItems_new }
  }))

  console.log(util.inspect(resourceList, { depth: null, colors: true }))

  var resourceList_ = resourceList.map(resource => {
    var heading = resource.heading
    var resourceListItems = resource.resourceListItems_new || resource.resourceListItems
    resourceListItems = resourceListItems.map(({ link, textName }) => {
      var filename = outputFileName({ link, textName })
      return { link, textName, filename }
    })
    resourceListItems = findAddIndexIfDuplicateFilename(resourceListItems)
    return {
      heading,
      resourceListItems,
    }
  })

  console.log(util.inspect(resourceList_, { depth: null, colors: true }))
  return resourceList_
}

async function getExpectedSize(videoUrl) {
  // try {
  const response = await axios.head(videoUrl)
  return parseInt(response.headers['content-length'])
  // } catch (error) {
  //   console.error('Error getting expected size:', error)
  //   return null
  // }
}

async function isVideoDownloadedAndMatchesSize(videoDownloadPath, link) {
  var expectedSize = await getExpectedSize(link)
  // if (expectedSize === null) {
  //   throw new Error(`Could not get expected size for video: ${videoUrl}`)
  // }
  const stats = await fsPromises.stat(videoPath)
  return stats.isFile() && stats.size === expectedSize
}

async function downloadResource_local({ downloadHerePath, link }) {
  var linkExists = await fileExists(link)
  if (!linkExists) { throw new Error(`Want to copy file ${link} to ${downloadHerePath}, but it doesnt exists`) }
  var destinationExists = await fileExists(downloadHerePath)
  if (destinationExists) { return 'already_exists' }
  await fsPromises.copyFile(link, downloadHerePath)
  return 'copied'
}

async function downloadResource_remote({ downloadHereDirPath, link, textName, filename, onSkip, onDownload, onProgressThrottled }) {
  // var link = 'http://www.archive.org/download/MIT14.01SCF10/MIT14_01SCF10_lec26_300k.mp4'
  // var textName = 'Lecture 26: Healthcare Economics'
  // var filename = 'Lecture 26: Healthcare Economics.mp4'
  // var downloadHereDirPath = '/home/srghma/Desktop/14-01sc-principles-of-microeconomics-fall-2011/Lecture Videos'
  // var downloadHerePath = path.join(downloadHereDirPath, filename)
  const dl = new DownloaderHelper(link, downloadHereDirPath, {
    fileName: filename,
    resumeOnIncomplete: true,
    resumeIfFileExists: true, // will not append (1).mp4
    override: { skip: true, skipSmaller: false },
    // removeOnStop: false, // remove the file when is stopped (default:true)
    removeOnFail: true, // remove the file when fail (default:true)
    retry: { maxRetries: 8, delay: 3000 }, // { maxRetries: number, delay: number in ms } or false to disable (default)
  })
  dl.on('skip', onSkip)
  dl.on('download', onDownload)
  dl.on('progress.throttled', onProgressThrottled)
  return dl.start()
}

async function main() {
  if (process.argv.length !== 5) {
    console.error('Usage: download-course.js <courseUrl> <downloadPath> <cachePath>')
    process.exit(1)
  }

  var courseName = "14-772-development-economics-macroeconomics-spring-2013"
  var courseUrl = process.argv[2] || `https://ocw.mit.edu/courses/${courseName}`
  var downloadPath = path.resolve(process.argv[3] || path.join(os.homedir(), "Desktop", courseName))
  var cachePath = path.resolve(process.argv[4] || path.join(os.homedir(), "Desktop", "ocw.tmp"))

  console.log({
    courseUrl,
    downloadPath,
    cachePath,
  })

  await mkdirp(cachePath)

  var extractPath = await downloadZip(courseUrl, cachePath)
  // var courseUrlOrExtractPath = courseUrl
  // var courseUrlOrExtractPath = extractPath

  var resourceList_courseUrl = await getIndexPageLinks({ downloadModeIsFromCache: false, courseUrl })
  var resourceList_extractPath = await getIndexPageLinks({ downloadModeIsFromCache: true, extractPath, courseUrl })
  console.log(util.inspect(resourceList_courseUrl, { depth: null, colors: true }))
  console.log(util.inspect(resourceList_extractPath, { depth: null, colors: true }))

  if (!deepEqual(resourceList_courseUrl, resourceList_extractPath)) {
    var delta = jsondiffpatch.diff(resourceList_courseUrl, resourceList_extractPath)
    var output = jsondiffpatch.formatters.console.format(delta)
    console.log(output)
  }

  var resourceList_ = resourceList_extractPath
  // var resourceList_ = resourceList_courseUrl
  console.log('Found', resourceList_.length, 'dirs to create.')

  const multibar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: ' {bar} | {filename} | {value}/{total}',
  }, cliProgress.Presets.shades_grey)

  try {
    for (var resource of resourceList_) {
      var { heading, resourceListItems } = resource
      var downloadHereDirPath = path.join(downloadPath, heading)
      // await fsPromises.unlink(downloadHereDirPath)
      await mkdirp(downloadHereDirPath)
      var queue = new PQueue({ concurrency: 10 })
      var promises = resourceListItems.map(resourceListItem => async () => {
        var { link, textName, filename } = resourceListItem

        if (link.endsWith('.mp4')) {
          // Error: Want to copy file /home/srghma/Desktop/ocw.tmp/14.04-fall-2020/static_resources/ocw_1404_finalreview_2020dec08_360p_16_9.mp4 to /home/srghma/Desktop/14-04-intermediate-microeconomic-theory-fall-2020/Lecture Videos/Final Exam Review for Intermediate Microeconomic Theory.mp4, but it doesnt exists
        }

        var downloadHerePath = path.join(downloadHereDirPath, filename)
        var isLocalPath = !link.startsWith('http')

        if (isLocalPath) {
          var result = await downloadResource_local({ downloadHerePath, link })
          if (result === 'already_exists') { multibar.log(`Skipped ${link} to ${downloadHerePath}`) }
          if (result === 'copied')         { multibar.log(`Copied ${link} to ${downloadHerePath}`) }
        } else {
          const progressBar = multibar.create(100, 0, { filename })
          // console.log('Downloading myres:', { link, textName, filename })
          try {
            await downloadResource_remote({
              downloadHereDirPath,
              link,
              textName,
              filename,
              onSkip:              () => { multibar.log(`Skip ${filename}`) },
              onDownload:          () => { progressBar.start(100, 0) },
              onProgressThrottled: stats => { progressBar.update(stats.progress, { filename }) }
              // console.log(`Downloaded ${myresDownloadPath}: ${stats.downloaded} bytes / ${stats.total} bytes (${stats.progress}%)`)
            })
          } catch (e) {
            console.error(e)
          }
          progressBar.stop()
          // console.log('Downloaded myres:', { link, textName, filename })
        }
      })
      await queue.addAll(promises)
    }
  } finally {
    multibar.stop()
  }
}

main()
