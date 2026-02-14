"use client"

interface JsonSyntaxProps {
  data: unknown
  collapsed?: boolean
}

export function JsonSyntax({ data }: JsonSyntaxProps) {
  const json = typeof data === "string" ? data : JSON.stringify(data, null, 2)
  const tokens = tokenize(json)

  return (
    <pre className="p-3 rounded bg-background border border-border text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
      {tokens.map((token, i) => (
        <span key={i} className={tokenClass(token.type)}>
          {token.value}
        </span>
      ))}
    </pre>
  )
}

type TokenType = "key" | "string" | "number" | "boolean" | "null" | "brace" | "bracket" | "colon" | "comma" | "whitespace"

interface Token {
  type: TokenType
  value: string
}

function tokenClass(type: TokenType): string {
  switch (type) {
    case "key":
      return "text-primary"
    case "string":
      return "text-log-info"
    case "number":
      return "text-log-warn"
    case "boolean":
      return "text-log-debug"
    case "null":
      return "text-muted-foreground italic"
    case "brace":
    case "bracket":
      return "text-muted-foreground"
    case "colon":
      return "text-muted-foreground"
    case "comma":
      return "text-muted-foreground/60"
    case "whitespace":
      return ""
    default:
      return "text-foreground"
  }
}

function tokenize(json: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let expectingKey = false

  while (i < json.length) {
    const ch = json[i]

    // Whitespace
    if (/\s/.test(ch)) {
      let ws = ""
      while (i < json.length && /\s/.test(json[i])) {
        ws += json[i]
        i++
      }
      tokens.push({ type: "whitespace", value: ws })
      continue
    }

    // Braces
    if (ch === "{") {
      tokens.push({ type: "brace", value: ch })
      expectingKey = true
      i++
      continue
    }
    if (ch === "}") {
      tokens.push({ type: "brace", value: ch })
      expectingKey = false
      i++
      continue
    }

    // Brackets
    if (ch === "[") {
      tokens.push({ type: "bracket", value: ch })
      expectingKey = false
      i++
      continue
    }
    if (ch === "]") {
      tokens.push({ type: "bracket", value: ch })
      i++
      continue
    }

    // Colon
    if (ch === ":") {
      tokens.push({ type: "colon", value: ": " })
      expectingKey = false
      // Skip the space after colon if present
      i++
      if (i < json.length && json[i] === " ") i++
      continue
    }

    // Comma
    if (ch === ",") {
      tokens.push({ type: "comma", value: ch })
      expectingKey = true
      i++
      continue
    }

    // String
    if (ch === '"') {
      let str = '"'
      i++
      while (i < json.length && json[i] !== '"') {
        if (json[i] === "\\") {
          str += json[i]
          i++
        }
        if (i < json.length) {
          str += json[i]
          i++
        }
      }
      if (i < json.length) {
        str += '"'
        i++
      }

      // Determine if this is a key or value
      const isKey = expectingKey || isKeyPosition(json, i)
      tokens.push({ type: isKey ? "key" : "string", value: str })
      if (isKey) expectingKey = false
      continue
    }

    // Number
    if (/[-\d]/.test(ch)) {
      let num = ""
      while (i < json.length && /[-\d.eE+]/.test(json[i])) {
        num += json[i]
        i++
      }
      tokens.push({ type: "number", value: num })
      continue
    }

    // Boolean / null
    if (json.substring(i, i + 4) === "true") {
      tokens.push({ type: "boolean", value: "true" })
      i += 4
      continue
    }
    if (json.substring(i, i + 5) === "false") {
      tokens.push({ type: "boolean", value: "false" })
      i += 5
      continue
    }
    if (json.substring(i, i + 4) === "null") {
      tokens.push({ type: "null", value: "null" })
      i += 4
      continue
    }

    // Fallback
    tokens.push({ type: "whitespace", value: ch })
    i++
  }

  return tokens
}

function isKeyPosition(json: string, afterStringPos: number): boolean {
  // Look ahead for a colon (skipping whitespace)
  let j = afterStringPos
  while (j < json.length && /\s/.test(json[j])) j++
  return j < json.length && json[j] === ":"
}
