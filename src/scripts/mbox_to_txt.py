# See README.md for information and usage.
#
# Copyright 2016 Christopher Allen Ogden
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import argparse
import mailbox
import re
import sys


# Patterns of text to delete from messages.
DELETION_PATTERS = [
    # Reply text:
    r'(\n|^)On.*\n?.*wrote:\n+(.|\n)*$',
    r'(\n|^)From:(.|\n)*$',

    # Forwarded messages:
    r'(\n|^)---------- Forwarded message ----------(.|\n)*$',

    # PGP:
    r'(\n|^)-----BEGIN PGP MESSAGE-----\n(.|\n)*-----END PGP MESSAGE-----\n',

    # Embedded links:
    r'<[^ ]+>',
]


def munge_message(text):
    """
    Munges an e-mail message (in text form).

    :param text: The e-mail message.
    :return: The munged e-mail message.
    """
    for pattern in DELETION_PATTERS:
        text = re.sub(pattern, '', text)
    return text


def unquoted_line(line):
    """
    Unquotes an e-mail message line according to RFC 3676.

    :param line: The (possibly quoted) message line.
    :return: (unquoted line, quote depth).
    """
    quote_depth = 0
    while line.startswith('>'):
        line = line[1:]
        quote_depth += 1
    return line, quote_depth


def unstuff_line(line):
    """
    Unstuffs an e-mail message line according to RFC 3637.

    :param line: The (possibly stuffed) message line.
    :return: The unstuffed message line.
    """
    if line.startswith(' '):
        return line[1:]
    return line


def unflow_line(line, delsp):
    """
    Unflows an e-mail message line according to RFC 3637.

    :param line: The (possibly soft-broken) message line.
    :param delsp: Whether or not soft-break spaces should be deleted.
    :return: (processed line, soft-broken)
    """
    if len(line) < 1:
        return line, False
    if line.endswith(' '):
        if delsp:
            line = line[:-1]
        return line, True
    return line, False


def unflow_text(text, delsp):
    """
    Unflows an e-mail message according to RFC 3637.

    :param text: The flowed message.
    :param delsp: Whether or not soft-break spaces should be deleted.
    :return: The processed message.
    """
    full_line = ''
    full_text = ''
    lines = text.splitlines()
    for line in lines:
        (line, quote_depth) = unquoted_line(line)
        line = unstuff_line(line)
        (line, soft_break) = unflow_line(line, delsp)
        full_line += line
        if not soft_break:
            full_text += '>' * quote_depth + full_line + '\n'
            full_line = ''
    return full_text


def part_to_text(part):
    """
    Converts an e-mail message part into text.

    Returns None if the message could not be decoded.

    :param part: E-mail message part.
    :return: Message text.
    """
    if part.get_content_type() != 'text/plain':
        print("DEBUG: Not text/plain", file=sys.stderr)
        return None
        
    charset = part.get_content_charset() or 'utf-8'  # Default to UTF-8 if no charset
    try:
        text = str(part.get_payload(decode=True), encoding=charset, errors='replace')
        if part.get_param('format') == 'flowed':
            text = unflow_text(text, part.get_param('delsp', False))
        return text
    except Exception as e:
        print(f"DEBUG: Error decoding text: {e}", file=sys.stderr)
        return None


def message_to_text(message):
    """
    Converts an e-mail message into text.

    Returns an empty string if the e-mail message could not be decoded as ASCII.

    :param message: E-mail message.
    :return: Message text.
    """
    text = ''
    for part in message.walk():
        part = part_to_text(part)
        if part:
            text += part
    return text


def mailbox_text(mb, author):
    """
    Returns the contents of a mailbox as text.

    Includes messages from 'author'.

    :param mb: Mailbox over which to iterate.
    :param author: Include messages from this author.
    :return: Nothing.
    """
    for message in mb:
        print(f"DEBUG: Checking message From: {message['From']}", file=sys.stderr)
        if not message['From']:
            print("DEBUG: No From field", file=sys.stderr)
            continue
        if author not in message['From']:
            print(f"DEBUG: Author {author} not in From field", file=sys.stderr)
            continue
        text = message_to_text(message)
        text = munge_message(text)
        if text and len(text) > 0:
            yield text
        else:
            print("DEBUG: No text extracted", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description='Convert mbox to text file.')
    parser.add_argument('mbox_file', help='.mbox file to parse')
    parser.add_argument('author', help='author to exclude')
    args = parser.parse_args()

    mb = mailbox.mbox(args.mbox_file, create=False)
    for text in mailbox_text(mb, args.author):
        print(text)


if __name__ == '__main__':
    main()