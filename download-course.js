#!/usr/bin/env node
// ./download-course.js https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011 /home/srghma/Desktop/14-01sc-principles-of-microeconomics-fall-2011/
// ./download-course.js https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011/download /home/srghma/Desktop/14-01sc-principles-of-microeconomics-fall-2011/

// import axios from 'axios'
// import * as fs from 'node:fs/promises'
// import path from 'node:path'
// import { exec } from 'node:child_process'
// import * as util from 'node:util'
// import { JSDOM } from 'jsdom'

var axios = require('axios')
var fs = require('node:fs/promises')
var path = require('node:path')
var { exec } = require('node:child_process')
var util = require('node:util')
var { JSDOM } = require('jsdom')
var { mkdirp } = require('mkdirp')
var AdmZip = require('adm-zip')


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

async function getPageDocument_fromUrl(url) {
  var response = await axios.get(url)
  var dom = new JSDOM(response.data, { url })
  var document = dom.window.document
  return document
}

async function getPageDocument_fromFile(filepath) {
  const htmlContent = await fs.readFile(filepath, 'utf-8');
  const dom = new JSDOM(htmlContent);
  var document = dom.window.document
  return document
}

function anchorElement_absoluteHref(element) {
  var document = element.ownerDocument
  var window = document.defaultView
  var url = new window.URL(element.href, window.location.href)
  console.log(`element.href`, element.href)
  console.log(`window.location.href`, window.location.href)
  console.log(`url`, url)
  console.log(`url.toString()`, url.toString())
  return url.toString()
}

function getResourceListItems(document) {
  var resourceListItems = Array.from(document.querySelectorAll('.resource-list-item')).map(item => {
    var link = item.querySelector('a[aria-label="Download file"]')
    var linkWithName = item.querySelector('a.resource-list-title')
    return {
      link: link.getAttribute('href'),
      name: linkWithName.textContent,
    }
  })
  return resourceListItems
}

// {
//   link: 'http://www.archive.org/download/MIT14.01SCF10/MIT14_01SCF10_problem_3-5_300k.mp4',
//   name: 'Problem 5 Solution Video'
// }
// => 'Problem 5 Solution Video.mp4'

// {
//   link: 'http://www.archive.org/download/MIT14.01SCF10/MIT14_01SCF10_problem_3-5_300k.mp4',
//   name: 'Problem 5 Solution Video.webm'
// }
// => 'Problem 5 Solution Video.webm.mp4'

// {
//   link: '/courses/14-01sc-principles-of-microeconomics-fall-2011/246785b93665931deee8867a16cfefd9_MIT14_01SCF11_soln01.pdf',
//   name: 'MIT14_01SCF11_soln01.myext'
// }
// => 'MIT14_01SCF11_soln01.myext.mp4'
function outputFileName({ link, name }) {
  // on /courses/14-01sc-principles-of-microeconomics-fall-2011/246785b93665931deee8867a16cfefd9_MIT14_01SCF11_soln01.pdf
  // Uncaught TypeError [ERR_INVALID_URL]: Invalid URL
  var dummyBaseUrl = 'http://dummy.org' // A dummy base URL
  var url = new URL(link, dummyBaseUrl)
  var url_extname = path.extname(url.pathname)
  // if name ends with url_extname - do nothing
  // else - add extname
  // Check if name ends with url_extname
  if (name.endsWith(url_extname)) { return name }
  return name + url_extname
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

async function downloadZip(courseUrl, cachePath) {
  async function downloadZipFile(zipUrl, downloadedZipPath) {
    const response = await axios.get(zipUrl, { responseType: 'stream' })
    const outputStream = fs.createWriteStream(downloadedZipPath)

    response.data.pipe(outputStream)

    return new Promise((resolve, reject) => {
      outputStream.on('finish', resolve)
      outputStream.on('error', reject)
    })
  }

  var indexPage = await getPageDocument_fromUrl(courseUrl)

  var zipUrl = anchorElement_absoluteHref(indexPage.querySelector('.download-course-button'))
  var zipFilenameWithExt = path.basename(zipUrl)
  var { name: zipFilenameWithoutExt } = path.parse(zipFilenameWithExt)
  var downloadedZipPath = path.join(cachePath, zipFilenameWithExt)
  var extractPath = path.join(cachePath, zipFilenameWithoutExt)

  try {
    // Check if the ZIP file has already been downloaded
    var isDownloaded = await fs.access(downloadedZipPath).then(() => true).catch(() => false)

    if (!isDownloaded) {
      // Download the ZIP file
      await downloadZipFile(zipUrl, downloadedZipPath)
      console.log('ZIP file downloaded:', zipUrl, 'to', downloadedZipPath)
    }

    var isExtracted = await fs.access(extractPath).then(() => true).catch(() => false)

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

async function getIndexPageLinks(courseUrl) {
  var indexPage = await getPageDocument_fromUrl(courseUrl)

  var resourceList = Array.from(indexPage.querySelectorAll('.resource-list')).map(resource => {
    var heading = resource.querySelector('h4').textContent
    var seeAllLink = resource.querySelector('.float-right a')
    var seeAllLinkHref = seeAllLink ? anchorElement_absoluteHref(seeAllLink) : null
    var resourceListItems = getResourceListItems(resource)

    return {
      heading,
      seeAllLinkHref,
      resourceListItems,
    }
  })

  resourceList = await Promise.all(resourceList.map(async (resource) => {
    if (!resource.seeAllLinkHref) { return resource }
    var page = await getPageDocument_fromUrl(resource.seeAllLinkHref)
    var resourceListItems_new = getResourceListItems(page)
    return { ...resource, resourceListItems_new }
  }))

  // console.log(util.inspect(resourceList, { depth: null, colors: true }))

  var resourceList_ = resourceList.map(resource => {
    var heading = resource.heading
    var resourceListItems = resource.resourceListItems_new || resource.resourceListItems
    resourceListItems = resourceListItems.map(({ link, name }) => {
      var filename = outputFileName({ link, name })
      return { link, name, filename }
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

async function downloadVideo(videoUrl, downloadPath) {
  var videoFilename = videoUrl.split('/').pop()
  var videoPath = path.join(downloadPath, videoFilename)

  try {
    var response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream',
    })

    var writer = fs.createWriteStream(videoPath)
    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
  } catch (error) {
    console.error('Error downloading video:', error)
  }
}

async function main() {
  if (process.argv.length !== 4) {
    console.error('Usage: download-course.js <courseUrl> <downloadPath> <cachePath>')
    process.exit(1)
  }

  var courseUrl = addDownloadPath("https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011")
  var downloadPath = path.resolve("/home/srghma/Desktop/14-01sc-principles-of-microeconomics-fall-2011/")
  var cachePath = path.resolve("/home/srghma/Desktop/ocw.tmp/")

  await mkdirp(cachePath)

  // var courseUrl = addDownloadPath(process.argv[2])
  // var downloadPath = path.resolve(process.argv[3])
  // var downloadPath = path.resolve(process.argv[4])

  try {
    var extractPath = await downloadZip(courseUrl, cachePath)
    var courseUrl_local = path.join(extractPath, '/download/index.html')

    var resourceList_ = await getIndexPageLinks(courseUrl, true)
    console.log('Found', resourceList_.length, 'dirs to create.')

    for (var resource of resourceList_) {
      var { heading, resourceListItems } = resource
      await mkdirp(path.join(downloadPath, heading))
      console.log('Downloading video:', videoLink)
      await downloadVideo(videoLink, downloadPath)
      console.log('Downloaded video:', videoLink)
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

main()
