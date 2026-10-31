#!/usr/bin/env python3
"""Plugin version policy for the claude-craft marketplace.

Default mode (blocking): lockstep. For every plugin with a local source, the
version in plugins/<name>/.claude-plugin/plugin.json must equal the version of
its entry in .claude-plugin/marketplace.json. (Remote sources such as c-thru
live in another repo and are skipped.)

--bump-advisory BASE (never fails): if files a plugin ships changed between
BASE and HEAD but its plugin.json version did not, emit a warning. Plugin
updates reach users only when the version changes, so an unbumped fix is
silently never delivered.

Compatible with Python 3.9 (macOS system python).
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARKETPLACE = os.path.join(".claude-plugin", "marketplace.json")
# Paths inside a plugin that are not delivered to users, so changing them needs no bump.
NOT_SHIPPED = ("/tests/", "/test/", "/fixtures/", ".test.", "/README.md", "/CHANGELOG.md", "/.DS_Store")


def annotate(level, title, msg):
    if os.environ.get("GITHUB_ACTIONS"):
        print("::%s title=%s::%s" % (level, title, msg))
    else:
        print("%s: %s" % (level.upper(), msg))


def git(*args):
    return subprocess.run(["git", "-C", ROOT] + list(args), capture_output=True, text=True)


def local_plugins():
    with open(os.path.join(ROOT, MARKETPLACE), encoding="utf-8") as fh:
        market = json.load(fh)
    for entry in market["plugins"]:
        src = entry["source"]
        if isinstance(src, str):
            yield entry, os.path.normpath(src)


def plugin_version(path):
    with open(os.path.join(ROOT, path, ".claude-plugin", "plugin.json"), encoding="utf-8") as fh:
        return json.load(fh).get("version")


def lockstep():
    bad = 0
    checked = 0
    for entry, src in local_plugins():
        checked += 1
        pv, mv = plugin_version(src), entry.get("version")
        if not pv or not mv:
            bad += 1
            print("FAIL %s: missing version (plugin.json=%r marketplace.json=%r)" % (entry["name"], pv, mv))
        elif pv != mv:
            bad += 1
            print("FAIL %s: plugin.json=%s but marketplace.json=%s (keep them in lockstep)" % (entry["name"], pv, mv))
    print("plugin version lockstep: %d local plugins, %d mismatched" % (checked, bad))
    return 1 if bad else 0


def bump_advisory(base):
    warned = 0
    for entry, src in local_plugins():
        changed = git("diff", "--name-only", "--diff-filter=ACMRD", base, "HEAD", "--", src).stdout.split()
        shipped = [f for f in changed if not any(s in "/" + f for s in NOT_SHIPPED)]
        if not shipped:
            continue
        old = git("show", "%s:%s/.claude-plugin/plugin.json" % (base, src))
        if old.returncode != 0:
            continue  # new plugin in this range
        old_version = json.loads(old.stdout).get("version")
        new_version = plugin_version(src)
        if old_version == new_version:
            warned += 1
            annotate("warning", "Plugin version not bumped",
                     "%s: %d shipped file(s) changed but version is still %s — users on the version-gated "
                     "update path will not receive this change (e.g. %s)" % (entry["name"], len(shipped), new_version, shipped[0]))
    print("version-bump advisory: %d plugin(s) changed without a bump" % warned)
    return 0


def main(argv):
    if len(argv) == 3 and argv[1] == "--bump-advisory":
        return bump_advisory(argv[2])
    if len(argv) == 1:
        return lockstep()
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
