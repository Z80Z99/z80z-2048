param(
  [Parameter(Mandatory = $true)] [string] $SourceDirectory
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# A deliberately small SVG renderer: authored absolute paths only, no scripts/fonts/external resources.
# Sources and PNGs use identical geometry. Supersampling keeps the broad engraved edges calm.
$renderer = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using System.Xml;

public static class SceneArtRasterizer {
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
  static Color ColorOf(string value, float opacity) {
    Color color = ColorTranslator.FromHtml(value);
    return Color.FromArgb((int)Math.Round(opacity * 255), color.R, color.G, color.B);
  }
  static void Draw(Graphics graphics, XmlElement element) {
    if (element.LocalName == "path") {
      if (element.HasAttribute("transform")) throw new ArgumentException("Transforms are not supported.");
      using (GraphicsPath path = PathOf(element.GetAttribute("d"))) {
        string alpha = element.GetAttribute("opacity");
        float opacity = alpha == "" ? 1 : Number(alpha);
        string fill = element.GetAttribute("fill"), stroke = element.GetAttribute("stroke");
        if (fill != "none") {
          using (var brush = new SolidBrush(ColorOf(fill == "" ? "#000000" : fill, opacity))) graphics.FillPath(brush, path);
        }
        if (stroke != "" && stroke != "none") {
          string width = element.GetAttribute("stroke-width");
          using (var pen = new Pen(ColorOf(stroke, opacity), width == "" ? 1 : Number(width))) {
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
  public static void Render(string input, string output) {
    var xml = new XmlDocument { XmlResolver = null };
    xml.Load(input);
    int width = int.Parse(xml.DocumentElement.GetAttribute("width"), CultureInfo.InvariantCulture);
    int height = int.Parse(xml.DocumentElement.GetAttribute("height"), CultureInfo.InvariantCulture);
    const int factor = 2;
    using (var source = new Bitmap(width * factor, height * factor, PixelFormat.Format32bppArgb)) {
      using (var graphics = Graphics.FromImage(source)) {
        graphics.Clear(Color.Transparent);
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        graphics.CompositingQuality = CompositingQuality.HighQuality;
        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        graphics.ScaleTransform(factor, factor);
        Draw(graphics, xml.DocumentElement);
      }
      using (var result = new Bitmap(width, height, PixelFormat.Format32bppArgb)) {
        using (var graphics = Graphics.FromImage(result)) {
          graphics.Clear(Color.Transparent);
          graphics.CompositingMode = CompositingMode.SourceCopy;
          graphics.CompositingQuality = CompositingQuality.HighQuality;
          graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
          graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
          graphics.DrawImage(source, new Rectangle(0, 0, width, height), 0, 0, source.Width, source.Height, GraphicsUnit.Pixel);
        }
        result.Save(output, ImageFormat.Png);
      }
    }
  }
}
'@
if (-not ('SceneArtRasterizer' -as [type])) { Add-Type -TypeDefinition $renderer -ReferencedAssemblies System.Drawing, System.Xml }
$source = [System.IO.Path]::GetFullPath($SourceDirectory)
$expected = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../static/scenes'))
if ($source.TrimEnd('\', '/') -ne $expected.TrimEnd('\', '/')) { throw 'Use only this project static/scenes directory.' }
foreach ($name in @('dungeon', 'abyss', 'final', 'camp', 'shop')) {
  $svg = Join-Path $source "$name.svg"
  $png = Join-Path $source "$name.png"
  [SceneArtRasterizer]::Render($svg, $png)
  Write-Output "$name : SVG + supersampled RGBA PNG"
}
