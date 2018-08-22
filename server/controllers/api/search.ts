import * as express from 'express'
import { buildNSFWFilter } from '../../helpers/express-utils'
import { getFormattedObjects } from '../../helpers/utils'
import { VideoModel } from '../../models/video/video'
import {
  asyncMiddleware,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  searchValidator,
  setDefaultPagination,
  setDefaultSearchSort,
  videosSearchSortValidator
} from '../../middlewares'
import { VideosSearchQuery } from '../../../shared/models/search'
import { getOrCreateAccountAndVideoAndChannel } from '../../lib/activitypub'
import { logger } from '../../helpers/logger'

const searchRouter = express.Router()

searchRouter.get('/videos',
  paginationValidator,
  setDefaultPagination,
  videosSearchSortValidator,
  setDefaultSearchSort,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  searchValidator,
  asyncMiddleware(searchVideos)
)

// ---------------------------------------------------------------------------

export { searchRouter }

// ---------------------------------------------------------------------------

function searchVideos (req: express.Request, res: express.Response) {
  const query: VideosSearchQuery = req.query
  if (query.search.startsWith('http://') || query.search.startsWith('https://')) {
    return searchVideoUrl(query.search, res)
  }

  return searchVideosDB(query, res)
}

async function searchVideosDB (query: VideosSearchQuery, res: express.Response) {
  const options = Object.assign(query, {
    includeLocalVideos: true,
    nsfw: buildNSFWFilter(res, query.nsfw)
  })
  const resultList = await VideoModel.searchAndPopulateAccountAndServer(options)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function searchVideoUrl (url: string, res: express.Response) {
  let video: VideoModel

  try {
    const syncParam = {
      likes: false,
      dislikes: false,
      shares: false,
      comments: false,
      thumbnail: true
    }

    const res = await getOrCreateAccountAndVideoAndChannel(url, syncParam)
    video = res ? res.video : undefined
  } catch (err) {
    logger.info('Cannot search remote video %s.', url)
  }

  return res.json({
    total: video ? 1 : 0,
    data: video ? [ video.toFormattedJSON() ] : []
  })
}
