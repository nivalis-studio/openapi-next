/**
 * This code is adapted from fast-content-type-parse
 * @see https://github.com/fastify/fast-content-type-parse/blob/master/index.js
 * @license MIT
 */

type NullObjectType = {
  [key: string]: string;
};

const createNullObject = (): NullObjectType => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return Object.create(null);
};

/**
 * RegExp to match *( ";" parameter ) in RFC 7231 sec 3.1.1.1
 *
 * parameter     = token "=" ( token / quoted-string )
 * token         = 1*tchar
 * tchar         = "!" / "#" / "$" / "%" / "&" / "'" / "*"
 *               / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~"
 *               / DIGIT / ALPHA
 *               ; any VCHAR, except delimiters
 * quoted-string = DQUOTE *( qdtext / quoted-pair ) DQUOTE
 * qdtext        = HTAB / SP / %x21 / %x23-5B / %x5D-7E / obs-text
 * obs-text      = %x80-FF
 * quoted-pair   = "\" ( HTAB / SP / VCHAR / obs-text )
 */
const paramRE =
  /; *([!#$%&'*+.^\w`|~-]+)=("(?:[\v\u0020\u0021\u0023-\u005B\u005D-\u007E\u0080-\u00FF]|\\[\v\u0020-\u00FF])*"|[!#$%&'*+.^\w`|~-]+) */gu;

/**
 * RegExp to match quoted-pair in RFC 7230 sec 3.2.6
 *
 * quoted-pair = "\" ( HTAB / SP / VCHAR / obs-text )
 * obs-text    = %x80-FF
 */
const quotedPairRE = /\\([\v\u0020-\u00FF])/gu;

/**
 * RegExp to match type in RFC 7231 sec 3.1.1.1
 *
 * media-type = type "/" subtype
 * type       = token
 * subtype    = token
 */
const mediaTypeRE = /^[!#$%&'*+.^\w|~-]+\/[!#$%&'*+.^\w|~-]+$/u;

type ContentType = {
  type: string;
  parameters: NullObjectType;
};

const defaultContentType: ContentType = {
  type: '',
  parameters: createNullObject(),
};

Object.freeze(defaultContentType.parameters);
Object.freeze(defaultContentType);

/**
 * Parse media type to object.
 * @param {string} header Content-Type header string to parse
 * @returns {ContentType} Parsed content type with type and parameters
 * @public
 */
export const parseContentType = (
  header: string | undefined | null,
): ContentType => {
  if (!header || typeof header !== 'string') {
    return defaultContentType;
  }

  let index = header.indexOf(';');
  const type = index === -1 ? header.trim() : header.slice(0, index).trim();

  if (!mediaTypeRE.test(type)) {
    return defaultContentType;
  }

  const result: ContentType = {
    type: type.toLowerCase(),
    parameters: createNullObject(),
  };

  // parse parameters
  if (index === -1) {
    return result;
  }

  let key: string;
  let value: string;

  paramRE.lastIndex = index;

  let match: RegExpExecArray | null;

  while (true) {
    match = paramRE.exec(header);

    if (match === null) break;

    if (match.index !== index) {
      return defaultContentType;
    }

    index += match[0].length;
    key = match[1].toLowerCase();
    value = match[2];

    if (value.startsWith('"')) {
      // remove quotes and escapes
      value = value.slice(1, -1);

      if (quotedPairRE.test(value)) {
        value = value.replaceAll(quotedPairRE, '$1');
      }
    }

    result.parameters[key] = value;
  }

  if (index !== header.length) {
    return defaultContentType;
  }

  return result;
};
