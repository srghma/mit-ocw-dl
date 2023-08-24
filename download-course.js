#!/usr/bin/env node
// ./download-course.js https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011 /home/srghma/Desktop/14-01sc-principles-of-microeconomics-fall-2011/
// ./download-course.js https://ocw.mit.edu/courses/14-01sc-principles-of-microeconomics-fall-2011/download /home/srghma/Desktop/14-01sc-principles-of-microeconomics-fall-2011/

import axios from 'axios'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { exec } from 'node:child_process'
import cheerio from 'cheerio'

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

async function getIndexPageLinks(courseUrl) {
    const response = await axios.get(courseUrl)
    const indexPage$ = cheerio.load(response.data)

    console.log(
      indexPage$('.resource-list').map((_i, x$) => {
        console.log(x$)
        return [
          x$.find('h4').text(),
          x$.find('span[text="See all"]').parent.attr('href'),
          x$.find('.resource-list-item').map((x$) => {
            const link$ = x$.find('a[aria-label="Download file"]')
            const linkWithName$ = x$.find('a.resource-list-title')
            return [link$.attr('href'), linkWithName$.text()]
          })
        ]
      })
    )

    const videoLinks = []

    indexPage$('a[aria-label="Download file"]').each((index, element) => {
        const videoLink = $(element).attr('href')
        videoLinks.push(videoLink)
    })

    return videoLinks
}

async function getVideoLinks(courseUrl) {
    const response = await axios.get(courseUrl)
    const indexPage$ = cheerio.load(response.data)
    const videoLinks = []

    indexPage$('a[aria-label="Download file"]').each((index, element) => {
        const videoLink = $(element).attr('href')
        videoLinks.push(videoLink)
    })

    return videoLinks
}

async function downloadVideo(videoUrl, downloadPath) {
    const videoFilename = videoUrl.split('/').pop()
    const videoPath = path.join(downloadPath, videoFilename)

    try {
        const response = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream',
        })

        const writer = fs.createWriteStream(videoPath)
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
        console.error('Usage: download-course.js <courseUrl> <downloadPath>')
        process.exit(1)
    }

    const courseUrl = addDownloadPath(process.argv[2])
    const downloadPath = path.resolve(process.argv[3])

    try {
        const page = await getIndexPageLinks(courseUrl)
        const videoLinks = await getVideoLinks(courseUrl)
        console.log('Found', videoLinks.length, 'videos to download.')

        for (const videoLink of videoLinks) {
            console.log('Downloading video:', videoLink)
            await downloadVideo(videoLink, downloadPath)
            console.log('Downloaded video:', videoLink)
        }
    } catch (error) {
        console.error('Error:', error)
    }
}

main()
