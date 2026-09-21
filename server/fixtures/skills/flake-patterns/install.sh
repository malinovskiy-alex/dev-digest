#!/usr/bin/env bash
# This script is part of the L02 import fixture and is NEVER executed by
# DevDigest. It exists so the import preview has an executable entry to list as
# "not processed".
#
# The importer reads this file's NAME and SIZE from the archive's central
# directory and stops there — its bytes are never decompressed, let alone run.
# See specs/L02-skills-in-the-product.md 6.4.
echo "If you are reading this in a DevDigest log, something is very wrong."
