#!/usr/bin/env bash
# React Native's prebuilt React and ReactNativeDependencies frameworks are
# versioned, macOS-style bundles in their Mac Catalyst slice, but ship loose
# copies at the root (binary, Resources, resource bundles) and a real
# Versions/Current directory. codesign rejects them on embed ("unsealed
# contents present in the root directory", "bundle format is ambiguous").
# This rebuilds the layout: Current links to A, loose resources move into
# A/Resources, and the root holds only links into Versions/Current.
#
# Usage: fix-catalyst-framework-layout.sh <Pods root>
# Run by plugins/withMacCatalyst.ts after pod install, and after React
# Native's own build phases swap in the Debug or Release frameworks.
set -euo pipefail

find "$1/React-Core-prebuilt" "$1/ReactNativeDependencies" -maxdepth 6 -type d \
  -path '*maccatalyst*' -name '*.framework' 2>/dev/null | while read -r fw; do
  version="$fw/Versions/A"
  [ -d "$version" ] || continue
  if [ ! -L "$fw/Versions/Current" ]; then
    rm -rf "$fw/Versions/Current"
    ln -s A "$fw/Versions/Current"
  fi
  mkdir -p "$version/Resources"
  for path in "$fw"/*; do
    name=$(basename "$path")
    [ -L "$path" ] && continue
    case "$name" in Headers | Modules | Versions) continue ;; esac
    if [ -e "$version/$name" ]; then
      rm -rf "$path"
    else
      rm -rf "$version/Resources/$name"
      mv "$path" "$version/Resources/"
    fi
  done
  for path in "$version"/*; do
    name=$(basename "$path")
    [ -e "$fw/$name" ] || [ -L "$fw/$name" ] || ln -s "Versions/Current/$name" "$fw/$name"
  done
done
