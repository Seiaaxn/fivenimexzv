// ─── NontonAnimeID scraper (server-only) ───
// Dijalankan di server (Worker) lewat /api/public/nontonanimeid.
// Tidak boleh diimpor dari komponen client.
import * as cheerio from "cheerio";

const DEFAULT_BASE = "https://s13.nontonanimeid.boats";

export class NontonAnimeIDScraper {
  constructor(baseUrl = DEFAULT_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "id,en-US;q=0.7,en;q=0.3",
    };
    this.lastNonce = null;
    this.lastAjaxUrl = null;
    this.lastUrl = null;
  }

  async _getSoup(url, params = {}) {
    this.lastUrl = url;
    let finalUrl = url;
    const keys = Object.keys(params);
    if (keys.length > 0) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) v.forEach((val) => q.append(`${k}[]`, val));
        else q.append(k, v);
      }
      finalUrl = `${url}?${q.toString()}`;
    }

    try {
      const response = await fetch(finalUrl, {
        headers: { ...this.headers, Referer: this.baseUrl },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const html = await response.text();
      const $ = cheerio.load(html);
      this._extractNonceAndAjaxUrl($);
      return $;
    } catch (error) {
      console.error(`[nontonanimeid] fetch failed ${finalUrl}:`, error?.message || error);
      return null;
    }
  }

  _extractNonceAndAjaxUrl($) {
    const scraper = this;
    $("script").each((i, el) => {
      const src = $(el).attr("src") || "";
      if (src.startsWith("data:text/javascript;base64,")) {
        try {
          const b64Data = src.split("base64,")[1];
          const decoded = atob(b64Data);
          const nonceMatch = decoded.match(/"nonce"\s*:\s*"([^"]+)"/);
          const urlMatch = decoded.match(/"url"\s*:\s*"([^"]+)"/);
          if (nonceMatch) scraper.lastNonce = nonceMatch[1];
          if (urlMatch) scraper.lastAjaxUrl = urlMatch[1].replace(/\\/g, "");
        } catch {
          /* ignore */
        }
      }
    });
  }

  _parseAnimeCard($, cardEl) {
    const card = $(cardEl);
    const link = card.attr("href") || "";

    const imgTag = card.find("img");
    const image = imgTag.attr("src") || imgTag.attr("data-src") || "";

    let title = "";
    const titleTag = card.find('[class*="title"]');
    if (titleTag.length > 0) {
      const span = titleTag.find("span");
      title =
        span.length > 0
          ? span.attr("data-title-default") || span.text().trim()
          : titleTag.text().trim();
    } else if (imgTag.length > 0) {
      title = imgTag.attr("alt") || "";
    }
    title = (title || "").trim();

    const ratingTag = card.find(".rating, .kotakscore, .as-rating");
    let rating = "";
    if (ratingTag.length > 0) {
      rating = ratingTag.text().replace("⭐", "").trim();
      if (!rating && ratingTag.hasClass("kotakscore"))
        rating = ratingTag.text().replace(/\n/g, "").trim();
    }

    const typeTag = card.find(".type, .as-type");
    const typeVal = typeTag.length > 0 ? typeTag.text().replace("📺", "").trim() : "";

    const seasonTag = card.find(".season, .as-season");
    const season = seasonTag.length > 0 ? seasonTag.text().replace("📅", "").trim() : "";

    const synopsisTag = card.find(".synopsis, .as-synopsis");
    const synopsis = synopsisTag.length > 0 ? synopsisTag.text().trim() : "";

    const genres = [];
    const genresContainer = card.find('[class*="genres"]');
    const scope = genresContainer.length > 0 ? genresContainer : card;
    scope.find(".genre-tag, .genre-pill, .as-genre-tag").each((i, el) => {
      genres.push($(el).text().trim());
    });

    return { title, link, image, rating, type: typeVal, season, synopsis, genres };
  }

  async getHome() {
    const $ = await this._getSoup(this.baseUrl);
    if (!$) return {};

    const data = {
      episode_terbaru: [],
      series_terbaru_movie: [],
      series_terbaru_tv: [],
      popular_series_semua: [],
      popular_genre: [],
      top_rating_anime: [],
      series_popular_summer: [],
    };

    $("#postbaru article.animeseries").each((i, el) => {
      const aTag = $(el).find("a");
      if (!aTag.length) return;
      const link = aTag.attr("href") || "";
      const imgTag = aTag.find("img");
      const image = imgTag.attr("src") || "";
      const titleSpan = aTag.find("h3.title span");
      let title = titleSpan.length
        ? titleSpan.attr("data-title-default") || titleSpan.text().trim()
        : "";
      if (!title && imgTag.length) title = imgTag.attr("alt") || "";
      data.episode_terbaru.push({
        title: (title || "").trim(),
        link,
        image,
        episode: aTag.find("span.types.episodes").text().trim(),
        status: aTag.find("span.types.status").text().trim(),
      });
    });

    const parseTabContent = (tabId) => {
      const items = [];
      $(`#${tabId} div.animeseries`).each((i, el) => {
        const aTag = $(el).find("a");
        if (!aTag.length) return;
        const link = aTag.attr("href") || "";
        const imgTag = aTag.find("img");
        const image = imgTag.attr("src") || "";
        const titleDiv = aTag.find("div.title");
        let title = "";
        if (titleDiv.length) {
          const titleSpan = titleDiv.find("span");
          title = titleSpan.length
            ? titleSpan.attr("data-title-default") || titleSpan.text().trim()
            : titleDiv.text().trim();
        }
        if (!title && imgTag.length) title = imgTag.attr("alt") || "";
        const scoreSpan = aTag.find("span.kotakscore");
        const score = scoreSpan.length
          ? scoreSpan.text().replace(/\n/g, "").replace(/ /g, "").replace("⭐", "").trim()
          : "";
        items.push({ title: (title || "").trim(), link, image, score });
      });
      return items;
    };

    data.series_terbaru_movie = parseTabContent("tab-7");
    data.series_terbaru_tv = parseTabContent("tab-8");
    data.popular_series_semua = parseTabContent("tab-9");
    data.popular_genre = parseTabContent("tab-10");

    const sidebar = $("#sidebar_right").length > 0 ? $("#sidebar_right") : $("body");

    let topRatingHeader = null;
    sidebar.find("h3, h2").each((i, el) => {
      if ($(el).text().includes("Top Rating Anime")) topRatingHeader = el;
    });
    if (topRatingHeader) {
      const ul = $(topRatingHeader).nextAll("ul.latestepisodes").first();
      ul.find("li").each((i, el) => {
        const aTag = $(el).find("a");
        if (!aTag.length) return;
        data.top_rating_anime.push({
          title: aTag.find("div.lefts").text().trim(),
          link: aTag.attr("href") || "",
          episodes_count: aTag.find("div.rights span.video").text().trim(),
        });
      });
    }

    let popularSummerHeader = null;
    sidebar.find("h3, h2").each((i, el) => {
      if ($(el).text().includes("Series Popular Summer")) popularSummerHeader = el;
    });
    if (popularSummerHeader) {
      const kotakbatas = $(popularSummerHeader).nextAll("div.kotakbatas").first();
      kotakbatas.find("div.bor").each((i, el) => {
        const aTag = $(el).find("a.popseries");
        if (!aTag.length) return;
        const imgTag = aTag.find("img");
        data.series_popular_summer.push({
          title: (imgTag.attr("alt") || "").trim(),
          link: aTag.attr("href") || "",
          image: imgTag.attr("src") || "",
        });
      });
    }

    return data;
  }

  _parseGrid($) {
    const results = [];
    const gridContainer = $("div.result");
    if (!gridContainer.length) return results;
    const cards = gridContainer.find("a.as-anime-card");
    if (cards.length) {
      cards.each((i, el) => results.push(this._parseAnimeCard($, el)));
    } else {
      gridContainer.find("div.animeseries").each((i, el) => {
        const aTag = $(el).find("a");
        if (aTag.length) results.push(this._parseAnimeCard($, aTag));
      });
    }
    return results;
  }

  async getAnimeList(page = 1, filters = {}) {
    const url = page > 1 ? `${this.baseUrl}/anime/page/${page}/` : `${this.baseUrl}/anime/`;
    const $ = await this._getSoup(url, filters);
    if (!$) return [];
    return this._parseGrid($);
  }

  async searchAnime(query, page = 1) {
    const url = page > 1 ? `${this.baseUrl}/page/${page}/` : `${this.baseUrl}/`;
    const $ = await this._getSoup(url, { s: query });
    if (!$) return [];
    return this._parseGrid($);
  }

  async getOngoingList(page = 1, sort = "date") {
    const url =
      page > 1 ? `${this.baseUrl}/ongoing-list/page/${page}/` : `${this.baseUrl}/ongoing-list/`;
    const $ = await this._getSoup(url, { sort, mode: "sort" });
    if (!$) return [];

    const results = [];
    $("div.gacha-grid a.gacha-card").each((i, el) => {
      const card = $(el);
      const imgTag = card.find("img");
      let title = card.find("h3.title").text().trim();
      if (!title && imgTag.length) title = imgTag.attr("alt") || "";
      const ratingSpan = card.find("span.skor-angka");
      const classes = card.attr("class") || "";
      const match = classes.match(/rarity-(\d+)/);
      results.push({
        title: title.trim(),
        link: card.attr("href") || "",
        image: imgTag.attr("src") || "",
        current_episode: card.find("span.current-ep").text().trim(),
        total_episodes: card.find("span.total-ep").text().trim(),
        rating: ratingSpan.length ? ratingSpan.text().replace("(", "").replace(")", "").trim() : "",
        hot: card.find("div.hot-tag").length > 0,
        rarity: match ? match[1] : "",
      });
    });
    return results;
  }

  async getPopularSeries(page = 1) {
    const url =
      page > 1 ? `${this.baseUrl}/popular-series/page/${page}/` : `${this.baseUrl}/popular-series/`;
    const $ = await this._getSoup(url);
    if (!$) return {};

    const data = { tabs: {}, overall_rank: [] };

    $("ul.tabs li.tab-link").each((i, el) => {
      const linkLi = $(el);
      const tabName = linkLi.text().trim();
      const tabId = linkLi.attr("data-tab");
      if (!tabName || !tabId) return;
      data.tabs[tabName] = [];
      $(`#${tabId} div.animeseries`).each((j, art) => {
        const aTag = $(art).find("a");
        if (aTag.length) data.tabs[tabName].push(this._parseAnimeCard($, aTag));
      });
    });

    $("ul.rank li").each((i, el) => {
      const aTag = $(el).find("a");
      if (!aTag.length) return;
      const imgTag = aTag.find("img");
      const mid = aTag.find("div.mid");
      let title = mid.find("h2").text().trim();
      if (!title && imgTag.length) title = imgTag.attr("alt") || "";
      const viewerText = mid.find("div.viewer").text().replace("Genre :", "").trim();
      data.overall_rank.push({
        title: title.trim(),
        link: aTag.attr("href") || "",
        image: imgTag.attr("src") || "",
        synopsis: mid.find("p").text().trim(),
        genres: viewerText
          ? viewerText
              .split(",")
              .map((g) => g.trim())
              .filter(Boolean)
          : [],
      });
    });

    return data;
  }

  async getJadwalRilis() {
    const $ = await this._getSoup(`${this.baseUrl}/jadwal-rilis/`);
    if (!$) return {};

    const data = {
      pengumuman_libur: [],
      perlu_diperhatikan: [],
      perkiraan_rilis_mendatang: [],
      kalender_rilis: {},
    };

    $("div.as-delay-announcements li").each((i, el) =>
      data.pengumuman_libur.push($(el).text().trim()),
    );
    $("div.as-important-notes li").each((i, el) =>
      data.perlu_diperhatikan.push($(el).text().trim()),
    );

    $("div.jr-upcoming-box div.jr-upcoming-item").each((i, el) => {
      const item = $(el);
      data.perkiraan_rilis_mendatang.push({
        title: item.find("span.jr-upcoming-title").text().trim(),
        image: item.find("img").attr("src") || "",
        episode_time: item.find("span.jr-upcoming-ep").text().trim(),
        time_left: item.find("div.jr-upcoming-time").text().trim(),
      });
    });

    const days = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"];
    days.forEach((day) => {
      const tabContent = $(`#${day}`);
      if (!tabContent.length) return;
      data.kalender_rilis[day] = {
        date_text: (tabContent.attr("data-date-text") || "").trim(),
        series: [],
      };
      tabContent.find("a.as-anime-card").each((i, el) => {
        const card = $(el);
        const genresList = [];
        card.find("span.jr-genre-pill").each((j, gEl) => genresList.push($(gEl).text().trim()));
        data.kalender_rilis[day].series.push({
          title: card.find("h3.as-anime-title").text().trim(),
          link: card.attr("href") || "",
          image: card.find("img").attr("src") || "",
          episode: card.find("span.jr-ep-text").text().trim(),
          type: card.find("span.jr-type-badge").text().trim(),
          time: card.find("span.time-text").text().replace("⏰", "").trim(),
          rating: card.find("span.rating-text").text().replace("⭐", "").trim(),
          members: card.find("span.members-text").text().replace("👤", "").trim(),
          genres: genresList,
        });
      });
    });

    return data;
  }

  async getGenresList(sort = "az") {
    const $ = await this._getSoup(`${this.baseUrl}/genres/`, { sort, mode: "sort" });
    if (!$) return [];

    const results = [];
    $("div.genre-grid-container a.genre-grid-card").each((i, el) => {
      const card = $(el);
      const link = card.attr("href") || "";
      results.push({
        name: card.find("h3.genre-name").text().trim(),
        link,
        slug: link.replace(/\/$/, "").split("/").pop() || "",
        image: card.find("img").attr("src") || "",
        total_series: card.find('span[class*="count"]').text().trim(),
        ongoing_series: card.find('span[class*="ongoing"]').text().trim(),
      });
    });
    return results;
  }

  async getGenreAnime(slug, page = 1) {
    const base = `${this.baseUrl}/genre/${slug}`;
    const url = page > 1 ? `${base}/page/${page}/` : `${base}/`;
    const $ = await this._getSoup(url);
    if (!$) return [];
    const results = this._parseGrid($);
    if (results.length) return results;
    const fallback = [];
    $("a.as-anime-card").each((i, el) => fallback.push(this._parseAnimeCard($, el)));
    return fallback;
  }

  async getAnimeDetail(animeUrlOrSlug) {
    const url = animeUrlOrSlug.startsWith("http")
      ? animeUrlOrSlug
      : `${this.baseUrl}/anime/${animeUrlOrSlug}/`;
    const $ = await this._getSoup(url);
    if (!$) return {};

    const titleH1 = $("h1.entry-title");
    let title = "";
    if (titleH1.length) {
      const span = titleH1.find("span");
      title = span.length
        ? span.attr("data-title-default") || span.text().trim()
        : titleH1.text().replace("Nonton", "").replace("Sub Indo", "").trim();
    }

    const animeCard = $("div.anime-card");
    const sidebarCard = animeCard.find("div.anime-card__sidebar");
    const poster = sidebarCard.find("img").attr("src") || "";
    const scoreDiv = sidebarCard.find("div.anime-card__score");
    const score = scoreDiv.find("span.value").text().trim();
    const typeVal = scoreDiv.find("span.type").text().trim();
    const trailer = sidebarCard.find("a.trailerbutton").attr("href") || "";

    const details = {};
    const genres = [];
    let synopsis = "";
    const mainInfo = animeCard.find("div.anime-card__main");
    mainInfo.find("ul.details-list li").each((i, el) => {
      const li = $(el);
      const labelTag = li.find("strong, span.detail-label");
      if (!labelTag.length) return;
      const label = labelTag.text().replace(":", "").trim();
      details[label] = li.text().replace(labelTag.text(), "").trim();
    });
    mainInfo.find("div.anime-card__genres a").each((i, el) => {
      genres.push({ name: $(el).text().trim(), link: $(el).attr("href") || "" });
    });
    synopsis = mainInfo.find("div#tab-synopsis").text().trim();

    const quickInfo = $("div.anime-card__quick-info");
    const status = quickInfo.find('span[class*="status"]').text().trim();
    let totalEpisodes = "";
    let episodeDuration = "";
    quickInfo.find("span.info-item").each((i, el) => {
      const text = $(el).text();
      if (text.toLowerCase().includes("episodes")) totalEpisodes = text.trim();
      else if (text.includes("min") || text.includes("menit")) episodeDuration = text.trim();
    });
    const seasonA = quickInfo.find("span.season a");
    const season = seasonA.text().trim();
    const seasonLink = seasonA.attr("href") || "";

    const episodes = [];
    $("section.anime-card__episode-list-section div.episode-list-items a.episode-item").each(
      (i, el) => {
        const aItem = $(el);
        episodes.push({
          title: aItem.find("span.ep-title").text().trim(),
          link: aItem.attr("href") || "",
          date: aItem.find("span.ep-date").text().trim(),
        });
      },
    );

    const recommended = [];
    $("div.related a.as-anime-card").each((i, el) => recommended.push(this._parseAnimeCard($, el)));

    return {
      title,
      poster,
      score,
      type: typeVal,
      trailer,
      synopsis,
      genres,
      details,
      status,
      total_episodes: totalEpisodes,
      episode_duration: episodeDuration,
      season,
      season_link: seasonLink,
      episodes,
      recommended_series: recommended,
    };
  }

  async getStreamingDetail(episodeUrlOrSlug) {
    const url = episodeUrlOrSlug.startsWith("http")
      ? episodeUrlOrSlug
      : `${this.baseUrl}/${episodeUrlOrSlug}/`;
    const $ = await this._getSoup(url);
    if (!$) return {};

    const title = $("h1.entry-title").text().trim();

    let animeTitle = "";
    let animeLink = "";
    const links = $("nav.breadcrumbs a").filter((i, el) => !!$(el).attr("href"));
    if (links.length >= 2) {
      const lastLink = links.last();
      animeTitle = lastLink.text().trim();
      animeLink = lastLink.attr("href") || "";
    }

    let prevLink = null;
    let nextLink = null;
    let allEpsLink = null;
    $("div.naveps div.nvs").each((i, el) => {
      const nvs = $(el);
      const aTag = nvs.find("a");
      if (!aTag.length) return;
      const href = aTag.attr("href") || "";
      const label = aTag.text().toLowerCase();
      if (label.includes("prev")) prevLink = href;
      else if (label.includes("next")) nextLink = href;
      else if (label.includes("all") || label.includes("episode") || nvs.hasClass("nvsc"))
        allEpsLink = href;
    });

    const iframeEl = $("div#videoku iframe");
    const defaultVideoUrl = iframeEl.attr("src") || iframeEl.attr("data-src") || "";

    const videoServers = [];
    $("ul.player li.serverplayer").each((i, el) => {
      const li = $(el);
      videoServers.push({
        server_name: li.text().trim(),
        post_id: li.attr("data-post") || "",
        server_type: li.attr("data-type") || "",
        nume: li.attr("data-nume") || "",
        is_active: li.hasClass("on"),
      });
    });

    const downloadLinks = [];
    $("div#download_area div#arealinker div.listlink").each((i, el) => {
      const listlink = $(el);
      const spanTag = listlink.find("span");
      const links2 = [];
      listlink.find("a").each((j, aEl) => {
        links2.push({ label: $(aEl).text().trim(), url: $(aEl).attr("href") || "" });
      });
      downloadLinks.push({
        format: spanTag.length ? spanTag.text().trim() : "Unknown",
        links: links2,
      });
    });

    const sidebar = $("#sidebar_right").length > 0 ? $("#sidebar_right") : $("body");

    const episodeTerbaru = [];
    let sidebarLatestHeader = null;
    sidebar.find("h3, h2").each((i, el) => {
      if ($(el).text().includes("Episode Terbaru")) sidebarLatestHeader = el;
    });
    if (sidebarLatestHeader) {
      $(sidebarLatestHeader)
        .nextAll("ul.latestepisodes")
        .first()
        .find("li")
        .each((i, el) => {
          const aTag = $(el).find("a");
          if (!aTag.length) return;
          episodeTerbaru.push({
            title: aTag.find("div.lefts").text().trim(),
            link: aTag.attr("href") || "",
            episode: aTag.find("div.rights span.video").text().trim(),
          });
        });
    }

    const seriesPopularSummer = [];
    let sidebarPopHeader = null;
    sidebar.find("h3, h2").each((i, el) => {
      if ($(el).text().includes("Series Popular Summer")) sidebarPopHeader = el;
    });
    if (sidebarPopHeader) {
      $(sidebarPopHeader)
        .nextAll("div.related")
        .first()
        .find("a.as-anime-card")
        .each((i, el) => seriesPopularSummer.push(this._parseAnimeCard($, el)));
    }

    return {
      title,
      anime_title: animeTitle,
      anime_link: animeLink,
      prev_episode_link: prevLink,
      next_episode_link: nextLink,
      all_episodes_link: allEpsLink,
      default_video_url: defaultVideoUrl,
      video_servers: videoServers,
      download_links: downloadLinks,
      episode_terbaru_sidebar: episodeTerbaru,
      series_popular_summer_sidebar: seriesPopularSummer,
      nonce: this.lastNonce,
      ajax_url: this.lastAjaxUrl,
    };
  }

  async getVideoIframe(postId, nume, serverName, nonce = null, ajaxUrl = null) {
    const finalNonce = nonce || this.lastNonce;
    const finalAjaxUrl = ajaxUrl || this.lastAjaxUrl || `${this.baseUrl}/wp-admin/admin-ajax.php`;
    if (!finalNonce) throw new Error("Nonce is required. Scrape a streaming page first.");

    const body = new URLSearchParams();
    body.append("action", "player_ajax");
    body.append("post", postId);
    body.append("nume", nume);
    body.append("serverName", serverName);
    body.append("nonce", finalNonce);

    const headers = {
      ...this.headers,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Origin: this.baseUrl,
    };
    if (this.lastUrl) headers["Referer"] = this.lastUrl;

    try {
      const response = await fetch(finalAjaxUrl, { method: "POST", headers, body });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const html = await response.text();
      const $ = cheerio.load(html);
      const iframe = $("iframe");
      return iframe.length ? iframe.attr("src") || iframe.attr("data-src") || "" : "";
    } catch (error) {
      console.error(`[nontonanimeid] iframe failed ${serverName}:`, error?.message || error);
      return "";
    }
  }
}

/** Slug dari URL nontonanimeid (mis. https://.../anime/solo-leveling/ → solo-leveling) */
export const slugFromLink = (link = "") => {
  try {
    const path = link.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
    return path.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
};
