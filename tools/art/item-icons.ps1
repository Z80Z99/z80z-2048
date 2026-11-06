param(
  [Parameter(Mandatory = $true)] [string] $ItemsDirectory,
  [Parameter(Mandatory = $true)] [string] $SetEmblemsDirectory,
  [switch] $VerifyOnly
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# Original hand-authored geometry on a 64-unit grid. No fonts, network, packages,
# borrowed game artwork, or random texture. SVG is the sole geometry source for PNG.
# The cream outer keyline preserves silhouettes on dark surfaces; the ink inner
# keyline preserves them on light surfaces. Facets are intentionally broad.
$renderer = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using System.Xml;

public static class ItemIconRasterizer {
  static float Number(string text) { return float.Parse(text, CultureInfo.InvariantCulture); }
  static GraphicsPath PathOf(string data) {
    var tokens = Regex.Matches(data, @"[MLCQZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?");
    var path = new GraphicsPath(FillMode.Winding);
    int index = 0;
    char command = ' ';
    PointF point = new PointF(0, 0), start = point;
    while (index < tokens.Count) {
      string token = tokens[index].Value;
      if (char.IsLetter(token[0])) {
        command = token[0]; index++;
        if (command == 'Z') { path.CloseFigure(); point = start; continue; }
      }
      if (command == 'M') {
        point = new PointF(Number(tokens[index++].Value), Number(tokens[index++].Value));
        path.StartFigure(); start = point; command = 'L';
      } else if (command == 'L') {
        PointF next = new PointF(Number(tokens[index++].Value), Number(tokens[index++].Value));
        path.AddLine(point, next); point = next;
      } else if (command == 'C') {
        PointF a = new PointF(Number(tokens[index++].Value), Number(tokens[index++].Value));
        PointF b = new PointF(Number(tokens[index++].Value), Number(tokens[index++].Value));
        PointF next = new PointF(Number(tokens[index++].Value), Number(tokens[index++].Value));
        path.AddBezier(point, a, b, next); point = next;
      } else if (command == 'Q') {
        PointF q = new PointF(Number(tokens[index++].Value), Number(tokens[index++].Value));
        PointF next = new PointF(Number(tokens[index++].Value), Number(tokens[index++].Value));
        PointF a = new PointF(point.X + (q.X-point.X)*2/3, point.Y + (q.Y-point.Y)*2/3);
        PointF b = new PointF(next.X + (q.X-next.X)*2/3, next.Y + (q.Y-next.Y)*2/3);
        path.AddBezier(point, a, b, next); point = next;
      } else { throw new ArgumentException("Unsupported path command: " + command); }
    }
    return path;
  }
  static void Draw(Graphics graphics, XmlElement element) {
    if (element.LocalName == "path") {
      using (GraphicsPath path = PathOf(element.GetAttribute("d"))) {
        string fill = element.GetAttribute("fill");
        string stroke = element.GetAttribute("stroke");
        if (fill != "none") {
          using (var brush = new SolidBrush(ColorTranslator.FromHtml(fill))) graphics.FillPath(brush, path);
        }
        if (stroke != "" && stroke != "none") {
          using (var pen = new Pen(ColorTranslator.FromHtml(stroke), Number(element.GetAttribute("stroke-width")))) {
            pen.StartCap = LineCap.Round; pen.EndCap = LineCap.Round; pen.LineJoin = LineJoin.Round;
            graphics.DrawPath(pen, path);
          }
        }
      }
    } else if (element.LocalName != "svg") {
      throw new ArgumentException("Unsupported SVG element: " + element.LocalName);
    }
    foreach (XmlNode child in element.ChildNodes) {
      var node = child as XmlElement;
      if (node != null) Draw(graphics, node);
    }
  }
  public static byte[] Render(string svg) {
    var xml = new XmlDocument { XmlResolver = null };
    xml.LoadXml(svg);
    const int size = 256, factor = 4;
    using (var source = new Bitmap(size * factor, size * factor, PixelFormat.Format32bppArgb)) {
      using (var graphics = Graphics.FromImage(source)) {
        graphics.Clear(Color.Transparent);
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        graphics.CompositingQuality = CompositingQuality.HighQuality;
        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        graphics.ScaleTransform(size * factor / 64f, size * factor / 64f);
        Draw(graphics, xml.DocumentElement);
      }
      using (var result = new Bitmap(size, size, PixelFormat.Format32bppArgb)) {
        using (var graphics = Graphics.FromImage(result)) {
          graphics.Clear(Color.Transparent);
          graphics.CompositingMode = CompositingMode.SourceCopy;
          graphics.CompositingQuality = CompositingQuality.HighQuality;
          graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
          graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
          graphics.DrawImage(source, new Rectangle(0, 0, size, size), 0, 0, source.Width, source.Height, GraphicsUnit.Pixel);
        }
        using (var stream = new MemoryStream()) {
          result.Save(stream, ImageFormat.Png);
          return stream.ToArray();
        }
      }
    }
  }
  public static string Inspect(string filename) {
    byte[] bytes = File.ReadAllBytes(filename);
    if (bytes.Length < 33 || bytes[0] != 137 || bytes[1] != 80 || bytes[2] != 78 || bytes[3] != 71 ||
        bytes[24] != 8 || bytes[25] != 6) throw new Exception("Expected 8-bit RGBA PNG: " + filename);
    using (var bitmap = new Bitmap(filename)) {
      if (bitmap.Width != 256 || bitmap.Height != 256) throw new Exception("Expected 256x256: " + filename);
      int x0 = 256, y0 = 256, x1 = -1, y1 = -1, transparent = 0, opaque = 0, partial = 0;
      for (int y = 0; y < 256; y++) for (int x = 0; x < 256; x++) {
        int a = bitmap.GetPixel(x, y).A;
        if (a == 0) transparent++;
        else {
          if (a == 255) opaque++; else partial++;
          x0 = Math.Min(x0, x); y0 = Math.Min(y0, y); x1 = Math.Max(x1, x); y1 = Math.Max(y1, y);
        }
      }
      if (transparent < 12000 || opaque < 2500 || partial < 100) throw new Exception("Invalid alpha coverage: " + filename);
      if (x0 < 4 || y0 < 4 || x1 > 251 || y1 > 251) throw new Exception("Artwork touches safe border: " + filename);
      if (x1-x0 < 110 || y1-y0 < 110) throw new Exception("Silhouette too small: " + filename);
      // Verify a readable core survives ordinary minification; no visual screening.
      foreach (int size in new int[] {20, 38}) {
        using (var thumb = new Bitmap(size, size, PixelFormat.Format32bppArgb)) {
          using (var graphics = Graphics.FromImage(thumb)) {
            graphics.Clear(Color.Transparent);
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            graphics.DrawImage(bitmap, 0, 0, size, size);
          }
          int solid = 0;
          for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) if (thumb.GetPixel(x, y).A >= 180) solid++;
          if (solid < size*size/14) throw new Exception("Insufficient small-size coverage: " + filename);
        }
      }
      return String.Format(CultureInfo.InvariantCulture, "256x256 RGBA; bounds [{0},{1}]-[{2},{3}]; alpha 0/255/partial {4}/{5}/{6}", x0, y0, x1, y1, transparent, opaque, partial);
    }
  }
}
'@
if (-not ('ItemIconRasterizer' -as [type])) {
  Add-Type -TypeDefinition $renderer -ReferencedAssemblies System.Drawing, System.Xml
}

$ink = '#302B29'
$cream = '#EFE4CB'
$edge = '#E5D5B2'
$shade = '#B7A384'
$bronze = '#A48050'
$steel = '#9EAAA9'

function Shape([string] $D, [string] $Fill = $cream, [double] $Width = 2.6) {
  '<path d="' + $D + '" fill="none" stroke="' + $edge + '" stroke-width="' + ($Width + 2.6).ToString([System.Globalization.CultureInfo]::InvariantCulture) + '"/>' + "`n" +
  '<path d="' + $D + '" fill="' + $Fill + '" stroke="' + $ink + '" stroke-width="' + $Width.ToString([System.Globalization.CultureInfo]::InvariantCulture) + '"/>'
}
function Facet([string] $D, [string] $Fill = $shade) {
  '<path d="' + $D + '" fill="' + $Fill + '"/>'
}
function Etch([string] $D, [string] $Stroke = $ink, [double] $Width = 1.9) {
  '<path d="' + $D + '" fill="none" stroke="' + $Stroke + '" stroke-width="' + $Width.ToString([System.Globalization.CultureInfo]::InvariantCulture) + '"/>'
}

$items = [ordered]@{}
# Five physical equipment silhouettes: nasal helmet, cuirass, paired gauntlets,
# split leather trousers, and forward-facing armored boots.
$items['helmet'] = @(
  (Shape 'M13 44 L13 29 C13 16 21 9 32 9 C44 9 51 17 51 29 L51 44 L43 53 L36 48 L32 53 L28 48 L21 53 Z' $steel),
  (Facet 'M32 11 C43 12 48 19 48 29 L48 43 L42 49 L37 46 L35 27 Z'),
  (Facet 'M18 26 C19 19 23 15 29 14 L28 26 Z' $cream),
  (Etch 'M16 29 Q32 25 48 29' $bronze 3),
  (Facet 'M18 33 L28 32 L27 39 L18 41 Z M46 33 L36 32 L37 39 L46 41 Z' $ink),
  (Shape 'M30 28 L34 28 L36 46 L32 51 L28 46 Z' $cream 2),
  (Etch 'M32 14 L32 23 M20 45 L24 43 M44 45 L40 43' $ink 1.8)
) -join "`n"
$items['armor'] = @(
  (Shape 'M23 10 Q32 15 41 10 L50 16 L55 27 L46 30 L45 47 L49 53 Q32 58 15 53 L19 47 L18 30 L9 27 L14 16 Z' $steel),
  (Facet 'M36 17 L44 18 L43 46 L46 51 L33 54 L33 35 Z'),
  (Facet 'M21 20 L28 18 L28 31 L22 35 Z' $cream),
  (Shape 'M24 10 Q32 15 40 10 L39 18 Q32 23 25 18 Z' $bronze 2.2),
  (Etch 'M18 19 L14 25 M46 19 L50 25 M22 36 Q32 41 42 36 M21 46 Q32 49 43 46' $ink 2),
  (Facet 'M32 25 L37 30 L32 36 L27 30 Z' $bronze),
  (Etch 'M32 25 L32 35' $cream 1.6)
) -join "`n"
$items['gloves'] = @(
  (Shape 'M9 38 L9 23 Q9 19 13 20 L14 28 L15 16 Q16 12 19 15 L20 27 L22 14 Q23 11 26 15 L26 29 L29 19 Q32 16 33 21 L30 39 L28 47 L13 48 Z' $steel),
  (Facet 'M24 17 L24 32 L20 36 L21 44 L27 43 L29 36 L31 23 L27 32 Z'),
  (Shape 'M11 43 L29 42 L30 54 L13 55 Z' $bronze 2.3),
  (Etch 'M15 47 L25 46 M15 32 L25 33' $cream 2.2),
  (Shape 'M37 38 L36 24 Q37 20 40 22 L42 29 L42 18 Q43 14 46 17 L47 29 L48 19 Q50 16 52 20 L52 32 L55 26 Q58 25 57 30 L54 43 L51 49 L40 49 Z' $steel),
  (Facet 'M49 23 L50 35 L46 41 L46 46 L51 46 L53 38 L55 30 L51 35 Z'),
  (Shape 'M38 44 L53 44 L52 55 L39 55 Z' $bronze 2.3),
  (Etch 'M42 48 L49 48 M41 34 L49 35' $cream 2.2)
) -join "`n"
$items['pants'] = @(
  (Shape 'M16 10 L47 10 L49 28 L45 55 L33 55 L31 32 L29 55 L16 55 L13 29 Z' $shade),
  (Facet 'M34 18 L44 17 L46 28 L42 52 L37 52 L37 32 L33 28 Z' $bronze),
  (Facet 'M19 19 L25 19 L23 29 L21 44 L18 44 L17 29 Z' $cream),
  (Shape 'M16 10 L47 10 L48 18 L15 18 Z' $bronze 2.3),
  (Shape 'M27 10 L36 10 L36 19 L27 19 Z' $cream 1.8),
  (Etch 'M31.5 12.5 L31.5 16.5 M31 21 L31 30 M18 45 L27 46 M35 46 L43 45' $ink 2),
  (Etch 'M19 50 L26 51 M36 51 L42 50' $cream 2)
) -join "`n"
$items['boots'] = @(
  (Shape 'M13 10 L29 10 L29 35 L33 42 L34 54 Q23 58 8 54 L8 47 Q9 40 13 37 Z' $shade),
  (Facet 'M23 15 L26 15 L26 37 L30 44 L30 51 L23 53 L23 41 Z' $bronze),
  (Shape 'M12 10 L30 10 L30 18 L12 18 Z' $steel 2.2),
  (Shape 'M9 45 Q20 42 31 46 L32 54 Q20 57 8 53 Z' $steel 2.2),
  (Etch 'M16 26 L25 26 M16 33 L25 33 M12 49 Q20 47 28 50' $cream 2.1),
  (Shape 'M39 11 L54 11 L53 35 L57 43 L56 54 Q46 57 36 54 L35 48 Q34 43 39 37 Z' $shade),
  (Facet 'M49 18 L51 18 L50 37 L54 44 L53 52 L48 53 L46 43 Z' $bronze),
  (Shape 'M38 11 L55 11 L55 19 L38 19 Z' $steel 2.2),
  (Shape 'M36 46 Q46 43 55 46 L55 54 Q46 56 36 53 Z' $steel 2.2),
  (Etch 'M42 27 L50 27 M41 34 L49 34 M39 49 Q46 47 52 50' $cream 2.1)
) -join "`n"

# Nine effect categories; these keys are an asset API, not a gameplay mapping.
$items['attack'] = @(
  (Shape 'M13 45 L20 38 L27 45 L20 53 Z' $bronze),
  (Shape 'M46 8 L52 9 L51 17 L29 40 L22 33 Z' $steel),
  (Facet 'M46 13 L47 17 L27 37 L25 35 Z' $cream),
  (Etch 'M45 17 L29 33' $ink 1.8),
  (Shape 'M17 31 L20 29 L34 42 L32 46 L27 43 L21 37 Z' $bronze 2.2),
  (Shape 'M11 50 L16 53 L12 58 L7 54 Z' $cream 2.2),
  (Shape 'M47 32 L49 40 L57 43 L49 46 L46 55 L43 46 L36 43 L43 40 Z' $cream 2.2),
  (Facet 'M47 37 L47 43 L53 43 L47 46 Z' $bronze)
) -join "`n"
$items['defense'] = @(
  (Shape 'M32 8 Q42 15 52 15 L50 36 C48 47 39 54 32 57 C25 54 16 47 14 36 L12 15 Q22 15 32 8 Z' $steel),
  (Facet 'M32 13 Q40 18 47 19 L45 35 Q42 46 32 51 Z'),
  (Etch 'M20 21 L22 34 Q23 42 29 46' $cream 2.4),
  (Shape 'M32 21 L39 31 L32 41 L25 31 Z' $bronze 2),
  (Facet 'M32 25 L35 31 L32 36 Z' $cream)
) -join "`n"
$items['health'] = @(
  (Shape 'M25 9 L39 9 L38 18 L26 18 Z' $bronze 2.3),
  (Shape 'M25 19 L39 19 L39 28 Q51 35 49 47 Q47 57 32 57 Q17 57 15 47 Q13 35 25 28 Z' $cream),
  (Facet 'M39 30 Q48 38 45 46 Q43 52 34 53 L36 38 Z'),
  (Facet 'M18 39 Q31 42 46 38 L46 46 Q44 53 32 53 Q20 53 18 46 Z' '#7F9F8E'),
  (Etch 'M22 29 L20 34 M25 24 L34 24' $bronze 2),
  (Facet 'M29 35 L35 35 L35 40 L40 40 L40 46 L35 46 L35 51 L29 51 L29 46 L24 46 L24 40 L29 40 Z' $cream)
) -join "`n"
$items['vitality'] = @(
  (Shape 'M32 55 C26 48 10 38 10 24 C10 11 25 9 32 21 C39 9 54 11 54 24 C54 38 38 48 32 55 Z' '#AD7770'),
  (Facet 'M42 16 Q53 19 49 29 Q46 37 35 46 L33 52 Q45 43 50 31 Q55 20 46 15 Z' '#805F59'),
  (Etch 'M18 23 Q20 17 26 20' $cream 2.4),
  (Shape 'M31 42 C28 28 36 23 47 25 C48 36 43 44 31 42 Z' '#829776' 2.2),
  (Etch 'M31 44 L42 30' $cream 2.2)
) -join "`n"
$items['time'] = @(
  (Shape 'M19 13 L45 13 L43 22 Q41 28 35 32 Q41 36 43 42 L45 51 L19 51 L21 42 Q23 36 29 32 Q23 28 21 22 Z' $cream),
  (Facet 'M37 16 L41 16 L39 23 L33 32 L39 42 L41 48 L37 48 L35 39 L31 33 Z' $steel),
  (Facet 'M23 20 L41 20 Q37 27 32 29 Q27 27 23 20 Z M22 47 L32 36 L42 47 Z' $bronze),
  (Shape 'M15 8 L49 8 L49 15 L15 15 Z' $bronze 2.4),
  (Shape 'M15 49 L49 49 L49 56 L15 56 Z' $bronze 2.4),
  (Etch 'M21 11 L42 11 M21 52 L42 52 M32 30 L32 34' $cream 1.8)
) -join "`n"
$items['starting-tile'] = @(
  (Shape 'M15 11 L46 9 L55 18 L53 49 L45 55 L13 53 L9 44 L10 19 Z' $steel),
  (Facet 'M46 12 L52 19 L50 47 L43 52 L15 50 L13 45 L44 45 Z'),
  (Etch 'M16 19 L20 15 L43 14 M15 23 L14 40' $cream 2.2),
  (Etch 'M49 22 L47 38 M18 47 L29 48' $ink 1.8),
  (Shape 'M32 19 L43 31 L32 43 L21 31 Z' $bronze 2.2),
  (Etch 'M32 23 L32 38 M26 31 L38 31' $cream 2.3),
  (Etch 'M12 43 L17 40 L20 42 M45 12 L43 19 L46 22' $ink 1.7)
) -join "`n"
$items['ward'] = @(
  (Shape 'M32 8 L49 17 L52 34 L43 50 L32 57 L21 50 L12 34 L15 17 Z' 'none' 3),
  (Etch 'M22 17 L32 12 L42 17 M18 33 L24 45 M46 33 L40 45' $bronze 2.4),
  (Shape 'M32 20 L40 32 L32 44 L24 32 Z' $cream 2.5),
  (Facet 'M32 24 L36 32 L32 39 Z' '#839B9A'),
  (Etch 'M32 8 L32 16 M12 34 L21 33 M52 34 L43 33 M32 49 L32 57' $cream 2.6)
) -join "`n"
$items['weakness'] = @(
  (Shape 'M12 46 L20 38 L26 44 L18 53 Z' $bronze),
  (Shape 'M22 33 L31 23 L31 30 L37 29 L29 40 Z' $steel),
  (Shape 'M38 12 L50 8 L49 21 L41 25 L42 19 L35 20 Z' $steel),
  (Facet 'M39 15 L47 12 L44 20 L41 20 L42 17 L38 18 Z' $cream),
  (Shape 'M16 31 L19 29 L34 43 L31 46 Z' $bronze 2.1),
  (Etch 'M32 18 L29 15 M37 30 L42 32' $bronze 2.6),
  (Shape 'M45 38 L54 38 L54 46 L49 55 L44 46 Z' '#95746D' 2.2),
  (Facet 'M48 40 L51 40 L51 46 L49 49 L47 46 Z' $cream)
) -join "`n"
$items['wealth'] = @(
  (Shape 'M10 42 L27 42 L27 53 Q19 58 10 53 Z' $bronze 2.3),
  (Etch 'M11 47 Q19 51 26 47 M11 51 Q19 55 26 51' $cream 1.8),
  (Shape 'M36 24 C36 40 12 40 12 24 C12 8 36 8 36 24 Z' $bronze),
  (Etch 'M18 19 Q23 14 29 19 M18 29 Q23 33 29 29' $cream 2),
  (Facet 'M24 18 L29 24 L24 30 L19 24 Z' $cream),
  (Shape 'M55 38 C55 56.7 27 56.7 27 38 C27 19.3 55 19.3 55 38 Z' $bronze),
  (Facet 'M45 27 Q53 33 51 41 Q49 49 40 50 Q49 52 53 43 Q57 31 45 27 Z' $shade),
  (Shape 'M41 30 L48 38 L41 46 L34 38 Z' $cream 1.9),
  (Etch 'M41 33 L41 43' $bronze 1.8)
) -join "`n"

# Twenty small emblems. Each has its own semantic geometry, not a recolored clone.
$sets = [ordered]@{}
$sets['tempest'] = @(
  (Shape 'M11 32 C11 19 22 11 34 12 C46 12 52 19 49 28 C47 34 39 34 37 29 C44 27 42 20 35 20 C26 20 21 26 22 33 C23 43 35 46 44 39 L53 41 C45 53 29 56 17 46 Q11 40 11 32 Z' '#829D9D' 3),
  (Etch 'M17 31 Q19 19 31 17 M27 45 Q37 49 46 43' $cream 2.6),
  (Shape 'M32 31 L40 31 L36 38 L42 38 L30 53 L33 41 L27 41 Z' $cream 2.2)
) -join "`n"
$sets['fortress'] = @(
  (Shape 'M11 55 L11 15 L20 15 L20 23 L27 23 L27 11 L37 11 L37 23 L44 23 L44 15 L53 15 L53 55 Z' $steel 3),
  (Facet 'M38 27 L49 27 L49 51 L39 51 Z' '#798786'),
  (Facet 'M25 55 L25 40 C25 30 39 30 39 40 L39 55 Z' $ink),
  (Etch 'M16 30 L23 30 M41 30 L48 30 M16 42 L20 42' $cream 2.5)
) -join "`n"
$sets['shadow'] = @(
  (Shape 'M32 9 Q17 13 11 42 L21 53 L43 53 L53 42 Q47 13 32 9 Z' '#817A95' 3),
  (Facet 'M32 15 Q22 24 21 39 Q32 47 43 39 Q42 24 32 15 Z' $ink),
  (Facet 'M23 31 L29 33 L28 37 L22 35 Z M41 31 L35 33 L36 37 L42 35 Z' $cream),
  (Etch 'M17 40 L23 47 M47 40 L41 47 M32 12 L32 19' '#B5AEC5' 2.4)
) -join "`n"
$sets['vampire'] = @(
  (Shape 'M32 17 L24 10 L24 21 L15 16 L7 24 L15 25 L11 41 L23 34 L32 49 L41 34 L53 41 L49 25 L57 24 L49 16 L40 21 L40 10 Z' '#9D747F' 2.7),
  (Facet 'M16 24 L25 27 L28 37 L20 30 L16 34 Z M48 24 L39 27 L36 37 L44 30 L48 34 Z' $ink),
  (Facet 'M26 25 L30 27 L28 30 Z M38 25 L34 27 L36 30 Z' $cream),
  (Shape 'M32 40 Q25 48 27 52 Q32 59 37 52 Q39 48 32 40 Z' $cream 2.1)
) -join "`n"
$sets['treasure'] = @(
  (Shape 'M12 28 L15 15 Q32 9 49 15 L52 28 L52 51 L12 51 Z' $bronze 3),
  (Facet 'M35 18 L47 19 L49 28 L49 48 L35 48 Z' '#8E6B42'),
  (Etch 'M14 29 L50 29 M21 17 L21 48 M43 17 L43 48' $cream 2.7),
  (Shape 'M27 25 L37 25 L37 37 L27 37 Z' $cream 2.3),
  (Facet 'M32 28 L34 31 L32 34 L30 31 Z' $ink)
) -join "`n"
$sets['flame'] = @(
  (Shape 'M34 8 C35 21 48 22 46 34 L52 29 C56 45 46 56 32 56 C17 56 8 45 13 32 L22 23 C19 35 26 35 27 28 C28 21 25 17 34 8 Z' '#B77E56' 3),
  (Facet 'M33 28 C34 36 43 39 40 46 Q34 56 25 47 C20 41 28 38 33 28 Z' $cream),
  (Etch 'M18 38 Q16 46 23 50' '#E2B785' 2.5)
) -join "`n"
$sets['frost'] = @(
  (Shape 'M32 8 L32 56 M11 20 L53 44 M11 44 L53 20 M24 12 L32 19 L40 12 M24 52 L32 45 L40 52 M12 29 L22 27 L19 17 M45 47 L42 37 L52 35 M12 35 L22 37 L19 47 M45 17 L42 27 L52 29' 'none' 3.6),
  (Shape 'M32 24 L39 32 L32 40 L25 32 Z' '#91B4BE' 2.5),
  (Facet 'M32 27 L35 32 L32 36 Z' $cream)
) -join "`n"
$sets['thunder'] = @(
  (Shape 'M30 8 L48 8 L36 27 L50 27 L21 57 L27 37 L15 37 Z' '#B4A066' 3),
  (Facet 'M33 12 L42 12 L30 31 L40 31 L27 46 L32 33 L22 33 Z' $cream)
) -join "`n"
$sets['holy'] = @(
  (Shape 'M32 8 L38 24 L54 30 L38 36 L32 56 L26 36 L10 30 L26 24 Z' $cream 3),
  (Facet 'M32 14 L32 30 L48 30 L35 34 L32 48 Z' '#C1AD73'),
  (Shape 'M18 15 Q32 6 46 15' 'none' 2.6),
  (Etch 'M32 25 L32 35' $bronze 2.5)
) -join "`n"
$sets['dark'] = @(
  (Shape 'M43 10 C24 4 10 18 11 34 C12 51 30 60 47 51 L53 41 C38 47 28 42 26 31 C24 20 31 13 43 10 Z' '#817B9B' 3),
  (Etch 'M17 28 Q16 43 30 49' '#C0B4CE' 2.8),
  (Shape 'M45 20 L48 27 L55 30 L48 33 L45 40 L42 33 L35 30 L42 27 Z' $cream 2.2)
) -join "`n"
$sets['nature'] = @(
  (Shape 'M16 49 C8 28 25 10 50 11 C54 36 37 52 16 49 Z' '#879E77' 3),
  (Facet 'M46 16 C43 31 34 41 21 45 C38 44 49 31 46 16 Z' '#647D5D'),
  (Etch 'M11 55 L42 22 M23 43 L22 30 M31 34 L41 34' $cream 2.8)
) -join "`n"
$sets['dragon'] = @(
  (Shape 'M16 53 L19 39 L11 29 L21 30 L17 16 L29 23 L38 10 L40 22 L52 26 L48 34 L55 39 L48 45 L36 44 L29 54 Z' '#AD8E72' 3),
  (Facet 'M24 30 L29 24 L38 19 L36 30 L42 37 L46 40 L34 40 L29 48 L22 48 L25 37 Z' '#7D8B82'),
  (Facet 'M38 28 L46 29 L43 33 L38 32 Z' $ink),
  (Etch 'M38 39 L48 39 M23 44 L27 38' $cream 2.5)
) -join "`n"
$sets['void'] = @(
  (Shape 'M32 9 L50 18 L55 37 L43 53 L23 55 L9 39 L12 20 Z' '#8D819F' 3),
  (Facet 'M32 18 L43 24 L46 36 L37 45 L25 44 L18 35 L21 24 Z' $ink),
  (Etch 'M16 22 L27 15 M48 36 L40 48 M22 49 L14 38' '#D3C4DB' 3),
  (Facet 'M29 25 L37 25 L33 34 L38 35 L28 41 L31 33 L26 31 Z' '#AB99BB')
) -join "`n"
$sets['time'] = @(
  (Shape 'M53 32 C53 60 11 60 11 32 C11 4 53 4 53 32 Z' $cream 3),
  (Facet 'M36 13 C56 19 54 43 37 50 L34 47 Q48 39 45 26 Q43 18 36 13 Z' '#A3977B'),
  (Etch 'M32 15 L32 19 M49 32 L45 32 M32 49 L32 45 M15 32 L19 32' $bronze 2.7),
  (Etch 'M32 23 L32 32 L41 38' $ink 3.6),
  (Facet 'M32 29 L35 32 L32 35 L29 32 Z' $bronze)
) -join "`n"
$sets['soul'] = @(
  (Shape 'M32 9 C20 10 14 21 17 32 C20 42 17 49 11 54 L27 51 L32 56 L37 51 L53 54 C47 49 44 42 47 32 C50 21 44 10 32 9 Z' '#94A8B2' 3),
  (Facet 'M39 15 Q48 23 42 34 Q37 43 42 49 L35 46 L32 51 L30 44 L34 32 Z' '#708694'),
  (Facet 'M23 25 Q28 20 29 30 L24 32 Z M41 25 Q36 20 35 30 L40 32 Z' $ink),
  (Etch 'M29 38 Q32 41 35 38' $cream 2.4)
) -join "`n"
$sets['warrior'] = @(
  (Shape 'M9 14 L15 10 L39 35 L33 41 Z' $steel 2.7),
  (Facet 'M14 15 L35 37 L34 39 L11 17 Z' $cream),
  (Shape 'M55 14 L49 10 L25 35 L31 41 Z' $steel 2.7),
  (Facet 'M50 15 L29 37 L30 39 L53 17 Z' $cream),
  (Shape 'M23 35 L26 32 L44 50 L40 54 Z M41 35 L38 32 L20 50 L24 54 Z' $bronze 2.7),
  (Etch 'M29 38 L24 43 M35 38 L40 43' $cream 2.2)
) -join "`n"
$sets['hunter'] = @(
  (Shape 'M18 11 C47 17 51 45 18 55 L27 35 L18 11 Z' 'none' 3.4),
  (Etch 'M20 13 L29 34 L20 53' '#9CAA80' 2.7),
  (Shape 'M11 33 L54 33 M44 24 L54 33 L44 42 M13 27 L20 33 L13 39' 'none' 3),
  (Etch 'M33 20 Q39 26 39 31 M39 37 Q38 43 31 47' $bronze 2.4)
) -join "`n"
$sets['sage'] = @(
  (Shape 'M10 16 Q22 11 32 18 Q42 11 54 16 L54 49 Q42 44 32 52 Q22 44 10 49 Z' $cream 3),
  (Facet 'M35 21 Q43 17 50 20 L50 44 Q42 41 35 46 Z' '#9D9DB4'),
  (Etch 'M32 19 L32 48 M16 24 Q22 22 26 25 M16 33 Q22 31 26 34 M16 41 L24 41' $bronze 2.5),
  (Facet 'M42 25 L44 31 L49 33 L44 35 L42 41 L40 35 L35 33 L40 31 Z' $cream)
) -join "`n"
$sets['thief'] = @(
  (Shape 'M9 20 Q21 13 32 22 Q43 13 55 20 L52 39 Q42 48 32 38 Q22 48 12 39 Z' '#918271' 3),
  (Facet 'M16 24 Q22 21 28 27 L25 33 Q18 33 16 28 Z M48 24 Q42 21 36 27 L39 33 Q46 33 48 28 Z' $ink),
  (Etch 'M14 20 L19 18 M45 18 L50 20' $cream 2.6),
  (Shape 'M31 37 L36 42 L33 54 L29 57 L27 51 Z' $steel 2.3),
  (Etch 'M31 44 L30 51' $cream 2)
) -join "`n"
$sets['king'] = @(
  (Shape 'M12 22 L23 31 L32 12 L41 31 L52 22 L47 52 L17 52 Z' '#B29964' 3),
  (Facet 'M32 17 L35 36 L44 35 L48 27 L43 47 L34 47 Z' $bronze),
  (Shape 'M17 44 L47 44 L47 52 L17 52 Z' $cream 2.4),
  (Shape 'M32 29 L37 35 L32 41 L27 35 Z' '#9E7776' 1.9),
  (Etch 'M21 48 L27 48 M37 48 L43 48' $bronze 2.4)
) -join "`n"

function PrepareDirectory([string] $Directory, [string] $Name, $Art) {
  $absolute = [System.IO.Path]::GetFullPath($Directory)
  if ([System.IO.Path]::GetFileName($absolute.TrimEnd('\', '/')) -ne $Name) {
    throw "Output directory must be the dedicated $Name directory."
  }
  if (-not (Test-Path -LiteralPath $absolute)) {
    if ($VerifyOnly) { throw "Missing directory: $absolute" }
    [void][System.IO.Directory]::CreateDirectory($absolute)
  }
  $allowed = @()
  foreach ($id in $Art.Keys) { foreach ($ext in @('svg', 'png')) { $allowed += "$id.$ext" } }
  foreach ($entry in Get-ChildItem -LiteralPath $absolute -Force) {
    if ($entry.PSIsContainer -or $entry.Name -notin $allowed) {
      throw "Refusing a directory with unrelated content: $($entry.FullName)"
    }
  }
  return $absolute
}
if ($items.Count -ne 14 -or $sets.Count -ne 20) { throw 'Unexpected asset counts.' }
# Preflight both dedicated directories before writing any resource.
$itemsOutput = PrepareDirectory $ItemsDirectory 'items' $items
$setsOutput = PrepareDirectory $SetEmblemsDirectory 'set-emblems' $sets
$utf8 = New-Object System.Text.UTF8Encoding($false)
$hashes = @{}
$sha = [System.Security.Cryptography.SHA256]::Create()
try {
  foreach ($group in @(@{ Art = $items; Directory = $itemsOutput }, @{ Art = $sets; Directory = $setsOutput })) {
    foreach ($id in $group.Art.Keys) {
      $body = $group.Art[$id]
      $svg = "<svg xmlns=`"http://www.w3.org/2000/svg`" width=`"256`" height=`"256`" viewBox=`"0 0 64 64`" fill=`"none`" stroke-linecap=`"round`" stroke-linejoin=`"round`">`n$body`n</svg>`n"
      $svgPath = Join-Path $group.Directory "$id.svg"
      $pngPath = Join-Path $group.Directory "$id.png"
      $rendered = [ItemIconRasterizer]::Render($svg)
      if ($VerifyOnly) {
        if ([System.IO.File]::ReadAllText($svgPath) -cne $svg) { throw "SVG is not current: $svgPath" }
        $stored = [System.IO.File]::ReadAllBytes($pngPath)
        $expectedHash = [System.BitConverter]::ToString($sha.ComputeHash($rendered))
        $actualHash = [System.BitConverter]::ToString($sha.ComputeHash($stored))
        if ($expectedHash -cne $actualHash) { throw "PNG differs from deterministic SVG rendering: $pngPath" }
      } else {
        [System.IO.File]::WriteAllText($svgPath, $svg, $utf8)
        [System.IO.File]::WriteAllBytes($pngPath, $rendered)
      }
      $hash = [System.BitConverter]::ToString($sha.ComputeHash($rendered))
      if ($hashes.ContainsKey($hash)) { throw "Duplicate artwork: $id and $($hashes[$hash])" }
      $hashes[$hash] = "$($group.Directory)/$id"
      $inspection = [ItemIconRasterizer]::Inspect($pngPath)
      Write-Output "$id : $inspection"
    }
    $entries = @(Get-ChildItem -LiteralPath $group.Directory -File)
    if ($entries.Count -ne $group.Art.Count * 2) { throw "Unexpected file count: $($group.Directory)" }
  }
} finally { $sha.Dispose() }
Write-Output 'PASS: 14 item icons + 20 distinct set emblems; 34 SVG + 34 PNG; transparent safe borders; 20/38px alpha coverage; deterministic SVG/PNG agreement.'
