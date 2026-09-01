export const APP_VERSION = __APP_VERSION__;
export const GITHUB_REPO = "Modestying/LogTimeLine";
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

export type UpdateResult =
  | { status: "current"; latest: string }
  | { status: "available"; latest: string; url: string }
  | { status: "error"; message: string };

function normalize(version: string): number[] {
  return version
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersions(current: string, latest: string): number {
  const a = normalize(current);
  const b = normalize(latest);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = (b[i] ?? 0) - (a[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

interface GithubRelease {
  tag_name?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
}

async function parseRelease(res: Response): Promise<{ latest: string; url: string } | null> {
  if (!res.ok) return null;
  const data = (await res.json()) as GithubRelease;
  if (!data.tag_name) return null;
  return {
    latest: data.tag_name.replace(/^v/i, ""),
    url: data.html_url || `${RELEASES_URL}/tag/${data.tag_name}`,
  };
}

export async function checkForUpdate(current = APP_VERSION): Promise<UpdateResult> {
  try {
    const latestRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    let release = await parseRelease(latestRes);

    if (!release) {
      const listRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=10`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (listRes.ok) {
        const items = (await listRes.json()) as GithubRelease[];
        const published = items.find((item) => !item.draft && !item.prerelease) ?? items[0];
        if (published?.tag_name) {
          release = {
            latest: published.tag_name.replace(/^v/i, ""),
            url: published.html_url || `${RELEASES_URL}/tag/${published.tag_name}`,
          };
        }
      }
    }

    if (!release) {
      const tagsRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=5`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (tagsRes.ok) {
        const tags = (await tagsRes.json()) as Array<{ name?: string }>;
        const name = tags[0]?.name;
        if (name) {
          release = {
            latest: name.replace(/^v/i, ""),
            url: `${RELEASES_URL}/tag/${name}`,
          };
        }
      }
    }

    if (!release) return { status: "error", message: "no-release" };
    if (compareVersions(current, release.latest) > 0) {
      return { status: "available", latest: release.latest, url: release.url };
    }
    return { status: "current", latest: release.latest };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "network" };
  }
}
