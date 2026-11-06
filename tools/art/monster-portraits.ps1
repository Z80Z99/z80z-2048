param(
  [string] $OutputDirectory = (Join-Path $PSScriptRoot '../../static/enemies'),
  [switch] $ValidateOnly
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# Original hand-authored monster busts. Geometry is shared by editable SVG and PNG.
# No fonts, stock art, external resources, random texture, or runtime dependencies.
# The renderer is adapted from the prior original map-art helper, on a 256-unit grid.
$renderer = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.Security.Cryptography;
using System.IO;
using System.Text.RegularExpressions;
using System.Xml;

public static class MonsterPortraitRasterizer {
  static float Number(string text) { return float.Parse(text, CultureInfo.InvariantCulture); }
  static GraphicsPath Path(string data) {
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
    if (element.LocalName == "title" || element.LocalName == "desc") return;
    if (element.LocalName == "path") {
      using (GraphicsPath path = Path(element.GetAttribute("d"))) {
        string opacityValue = element.GetAttribute("opacity");
        float opacity = opacityValue == "" ? 1 : Number(opacityValue);
        string fill = element.GetAttribute("fill"), stroke = element.GetAttribute("stroke");
        if (fill != "none") {
          using (var brush = new SolidBrush(ColorOf(fill == "" ? "#000000" : fill, opacity))) graphics.FillPath(brush, path);
        }
        if (stroke != "" && stroke != "none") {
          string width = element.GetAttribute("stroke-width");
          using (var pen = new Pen(ColorOf(stroke, opacity), width == "" ? 1 : Number(width))) {
            pen.StartCap = LineCap.Round; pen.EndCap = LineCap.Round;
            pen.LineJoin = LineJoin.Round;
            graphics.DrawPath(pen, path);
          }
        }
      }
    } else if (element.LocalName != "svg" && element.LocalName != "g") {
      throw new ArgumentException("Unsupported SVG element: " + element.LocalName);
    }
    foreach (XmlNode child in element.ChildNodes) {
      var node = child as XmlElement;
      if (node != null) Draw(graphics, node);
    }
  }
  public static void Render(string svg, string output) {
    var xml = new XmlDocument { XmlResolver = null };
    xml.LoadXml(svg);
    const int size = 256, factor = 4;
    using (var source = new Bitmap(size * factor, size * factor, PixelFormat.Format32bppArgb)) {
      using (var graphics = Graphics.FromImage(source)) {
        graphics.Clear(Color.Transparent);
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        graphics.CompositingQuality = CompositingQuality.HighQuality;
        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        graphics.ScaleTransform(factor, factor);
        Draw(graphics, xml.DocumentElement);
      }
      using (var result = new Bitmap(size, size, PixelFormat.Format32bppArgb)) {
        using (var graphics = Graphics.FromImage(result)) {
          graphics.Clear(Color.Transparent);
          graphics.CompositingMode = CompositingMode.SourceCopy;
          graphics.CompositingQuality = CompositingQuality.HighQuality;
          graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
          graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
          using (var attributes = new ImageAttributes()) {
            attributes.SetWrapMode(WrapMode.TileFlipXY);
            graphics.DrawImage(source, new Rectangle(0, 0, size, size), 0, 0, source.Width, source.Height, GraphicsUnit.Pixel, attributes);
          }
        }
        result.Save(output, ImageFormat.Png);
      }
    }
  }
  public static string Check(string file) {
    int transparent = 0, partial = 0, opaque = 0;
    int left = 256, top = 256, right = -1, bottom = -1;
    using (var bitmap = new Bitmap(file)) {
      if (bitmap.Width != 256 || bitmap.Height != 256 || bitmap.PixelFormat != PixelFormat.Format32bppArgb)
        throw new InvalidDataException("Expected 256x256 RGBA: " + file);
      for (int y = 0; y < 256; y++) for (int x = 0; x < 256; x++) {
        int alpha = bitmap.GetPixel(x, y).A;
        if (alpha == 0) transparent++;
        else {
          if (alpha == 255) opaque++; else partial++;
          left = Math.Min(left, x); top = Math.Min(top, y);
          right = Math.Max(right, x); bottom = Math.Max(bottom, y);
        }
      }
    }
    if (transparent < 12000 || partial < 200 || opaque < 5000 || left < 4 || top < 4 || right > 251 || bottom > 251)
      throw new InvalidDataException("Invalid alpha coverage, empty artwork, or clipped silhouette: " + file);
    string hash;
    using (var sha = SHA256.Create()) using (var stream = File.OpenRead(file)) {
      hash = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
    }
    return string.Format(CultureInfo.InvariantCulture,
      "{{\"transparent\":{0},\"partial\":{1},\"opaque\":{2},\"bounds\":[{3},{4},{5},{6}],\"sha256\":\"{7}\"}}",
      transparent, partial, opaque, left, top, right, bottom, hash);
  }
}
'@
if (-not ('MonsterPortraitRasterizer' -as [type])) {
  Add-Type -TypeDefinition $renderer -ReferencedAssemblies System.Drawing, System.Xml, System.Security
}

$expected = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../static/enemies'))
$output = [System.IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\', '/')
if ($output -ne $expected.TrimEnd('\', '/')) { throw 'OutputDirectory must be this source project static/enemies directory.' }
if ([System.IO.Path]::GetFullPath($PSScriptRoot) -notlike 'E:\Zcode project\z80z-2048\tools\art*') {
  throw 'Generate from the approved E: source project only.'
}

# Shared charcoal ink, warm edge light, and broad painterly facets. A thin warm line
# sits inside the thick charcoal silhouette stroke for legibility on dark panels.
$I = '#242522'; $R = '#c7b99a'; $P = '#e4d7b9'; $S = '#ad9b7e'; $D = '#55534b'
function Shape([string] $d, [string] $fill, [string] $rim = $R) {
  "<path d=`"$d`" fill=`"$fill`" stroke=`"$I`" stroke-width=`"7`"/>"
  "<path d=`"$d`" fill=`"none`" stroke=`"$rim`" stroke-width=`"1.65`" opacity=`"0.72`"/>"
}
function Facet([string] $d, [string] $fill, [string] $opacity = '1') {
  "<path d=`"$d`" fill=`"$fill`" opacity=`"$opacity`"/>"
}
function Ink([string] $d, [string] $color = $I, [string] $width = '3', [string] $opacity = '1') {
  "<path d=`"$d`" fill=`"none`" stroke=`"$color`" stroke-width=`"$width`" opacity=`"$opacity`"/>"
}
function Eye([string] $d, [string] $color) {
  "<path d=`"$d`" fill=`"$color`" stroke=`"$color`" stroke-width=`"8`" opacity=`"0.13`"/>"
  "<path d=`"$d`" fill=`"$color`"/>"
}

$art = [ordered]@{}
$names = [ordered]@{}
$accent = [ordered]@{}

# Scavenger rat: unequal bitten ears, hunched fur collar, long muzzle and incisors.
$names.rat = 'Fang Rat'; $accent.rat = '#b97e6b'
$art.rat = @(
  Shape 'M54 213 Q63 177 86 171 L172 169 Q199 182 210 218 L179 230 L144 238 L112 231 L81 235 Z' '#777267'
  Facet 'M73 214 L95 183 L110 203 L98 228 Z M166 181 L198 214 L170 229 L146 215 Z' '#514d46'
  Ink 'M83 210 L91 196 M94 220 L103 208 M175 205 L185 214 M165 220 L173 224' '#b4a98d' '3'
  Shape 'M85 93 C51 105 28 78 38 47 Q44 29 64 38 L73 32 L78 47 Q96 51 101 80 Z' '#8e887b'
  Facet 'M73 84 Q46 88 48 57 Q55 43 70 57 L82 73 Z' '#a67668'
  Ink 'M52 58 Q52 71 66 76' '#d0a691' '3'
  Shape 'M156 83 Q158 48 185 43 Q214 40 220 69 Q223 102 179 106 Z' '#989180'
  Facet 'M176 86 Q174 60 191 57 Q208 59 205 78 Q198 95 181 95 Z' '#a67668'
  Shape 'M94 65 L120 53 L135 61 L151 56 L175 78 L186 110 L175 139 L164 171 L150 188 L122 195 L96 179 L79 151 L70 124 L77 94 Z' '#9c927e'
  Facet 'M128 61 L157 78 L169 117 L152 151 L132 164 L130 115 Z' '#c0b196'
  Facet 'M94 76 L83 112 L93 142 L99 168 L122 192 L96 177 L77 141 L74 115 Z M165 83 L183 113 L171 142 L154 171 L145 151 L163 121 Z' '#605d54'
  Facet 'M83 116 Q101 113 113 130 L104 144 L88 138 Z M148 130 Q165 108 177 114 L169 139 L153 145 Z' $I
  Eye 'M94 125 L105 128 L103 135 L94 133 Z M157 127 L168 121 L166 132 L157 135 Z' '#d6a180'
  Shape 'M105 140 Q128 130 148 139 L164 155 L155 179 L137 196 L122 193 L102 178 L91 158 Z' '#c2b197'
  Facet 'M136 145 L159 157 L147 180 L131 189 L127 166 Z' '#8b7a65'
  Shape 'M115 145 Q129 138 143 146 L138 158 L125 163 L115 155 Z' '#51423d'
  Ink 'M129 159 L128 173 M105 170 Q127 182 151 167' $I '4'
  Shape 'M113 176 L126 180 L124 198 L115 194 Z M134 179 L146 175 L140 194 L131 198 Z' $P
  Ink 'M103 151 L58 141 M102 162 L41 164 M100 172 L56 189 M153 151 L205 136 M155 162 L219 161 M153 174 L200 190' '#cbc0a7' '2.8'
  Ink 'M99 88 L105 97 M110 76 L114 88 M143 78 L151 88 M83 151 L91 158' '#d0c2a4' '3'
) -join "`n"

# Lesser slime: translucent lopsided glass-green body and cut-gem eyes.
$names.slime = 'Glass Slime'; $accent.slime = '#8da88a'
$art.slime = @(
  Shape 'M29 196 Q34 168 56 156 C63 126 62 91 84 68 Q111 42 141 59 C167 51 188 74 191 112 Q192 148 213 166 Q233 183 227 206 Q225 219 203 224 L176 220 Q142 239 109 225 L77 232 Q58 222 40 224 Q23 215 29 196 Z' '#748d79' '#cee0bb'
  Facet 'M39 197 Q53 175 73 165 Q73 111 89 85 Q109 63 132 68 Q108 80 103 117 L102 184 L75 213 L46 216 Z' '#b3c7a0' '0.66'
  Facet 'M147 65 Q182 77 181 122 Q178 156 199 179 L215 197 L198 214 L170 207 L143 222 L118 214 L146 188 L157 139 Z' '#435f55' '0.63'
  Facet 'M87 92 Q91 80 105 77 Q93 100 90 123 Q82 131 79 118 Z M73 181 Q88 175 90 184 Q85 197 74 199 Z' '#e2ead0' '0.75'
  Facet 'M82 139 L99 120 L119 133 L115 157 L96 168 L80 156 Z M138 132 L154 118 L174 135 L177 155 L157 165 L137 153 Z' '#324c46'
  Eye 'M91 141 L100 132 L110 141 L103 155 L93 153 Z M148 138 L158 130 L167 139 L160 152 L150 151 Z' '#c8dba2'
  Facet 'M99 132 L100 145 L110 141 Z M158 130 L157 143 L167 139 Z' '#f1edc4'
  Ink 'M94 142 L100 145 L103 154 M152 140 L157 143 L160 151' '#6a876b' '2.4'
  Facet 'M106 181 Q130 192 153 177 Q144 205 125 206 Q109 202 106 181 Z' '#34534b'
  Ink 'M119 194 Q130 198 141 191' '#b9c9a1' '3'
  Ink 'M51 205 Q62 210 73 207 M161 211 Q176 204 191 210' '#c3d1ad' '3'
  Facet 'M118 97 Q126 84 132 96 Q135 104 128 109 Q119 108 118 97 Z M183 184 Q189 176 196 183 Q198 192 190 195 Z' '#c8ddba' '0.45'
) -join "`n"

# Skeleton: broken clavicle armor and an elongated anatomically drawn skull.
$names.skeleton = 'Bone Soldier'; $accent.skeleton = '#baa78a'
$art.skeleton = @(
  Shape 'M32 220 L47 186 L85 169 L109 181 L150 178 L181 168 L213 187 L224 221 L191 231 L162 223 L129 236 L95 227 L59 234 Z' '#696960'
  Facet 'M48 199 L80 180 L93 200 L68 216 L39 220 Z M176 180 L204 197 L216 219 L188 219 L163 201 Z' '#9a9882'
  Shape 'M86 164 L99 152 L153 151 L169 163 L157 198 L140 215 L112 211 L95 192 Z' '#b6a384'
  Facet 'M144 158 L157 167 L141 205 L126 211 L131 180 Z' '#73685a'
  Ink 'M104 177 L149 179 M108 190 L143 192 M116 202 L137 203' $I '4'
  Shape 'M82 42 L111 28 L145 30 L174 44 L186 76 L181 109 L194 133 L175 151 L163 185 L145 202 L113 204 L93 187 L82 156 L62 138 L74 110 L70 76 Z' '#c9b797'
  Facet 'M112 34 L143 37 L166 56 L172 92 L158 114 L134 108 L111 87 L90 82 L85 57 Z' '#e2d2ad'
  Facet 'M163 45 L183 77 L175 109 L184 132 L164 147 L153 184 L136 198 L140 150 L153 123 L165 95 Z M78 79 L92 96 L95 117 L84 141 L72 136 L81 110 Z' '#97876d'
  Facet 'M82 98 Q101 94 120 111 L111 139 Q87 142 81 128 Z M134 111 Q154 94 173 100 L172 128 Q160 145 142 137 Z' $I
  Eye 'M94 115 L110 119 L106 126 L94 127 Z M145 118 L161 112 L160 125 L149 127 Z' '#b9b58c'
  Facet 'M126 129 L116 153 L128 149 L138 153 Z' '#49463d'
  Ink 'M95 151 L107 156 M157 152 L147 157 M104 55 L119 64 L113 79 L127 89 M153 57 L157 72' '#6a6051' '3.2'
  Shape 'M97 164 Q126 176 160 162 L153 191 L137 199 L115 197 L103 187 Z' '#c4b291'
  Facet 'M104 169 Q128 179 154 168 L148 186 L117 189 L108 183 Z' $I
  Ink 'M114 174 L115 184 M127 177 L127 188 M140 175 L138 187' $P '6'
  Ink 'M87 146 L94 141 M165 144 L176 138 M88 183 L97 179 M167 178 L178 182' '#e2cfaa' '3'
  Ink 'M62 193 L74 197 M187 195 L199 193 M80 214 L93 210' '#43453f' '4'
) -join "`n"

# Cave bat: full membranous wings frame a furry short-necked, fanged head.
$names.bat = 'Cave Bat'; $accent.bat = '#9d8199'
$art.bat = @(
  Shape 'M99 134 C64 124 48 94 21 69 L27 107 L18 139 Q38 130 47 153 Q55 140 71 172 Q86 159 99 190 L120 185 Z' '#756675' '#bdaec0'
  Facet 'M29 89 L39 118 L49 142 L70 158 L86 168 L102 164 L84 142 L54 125 Z' '#9b8397'
  Ink 'M28 86 Q47 127 96 148 M27 107 Q57 127 99 164 M48 146 L51 127 M73 164 L76 141' '#40383f' '3.5'
  Shape 'M156 134 C193 121 207 91 235 64 L229 108 L239 140 Q216 126 207 154 Q195 139 182 171 Q166 158 156 190 L135 181 Z' '#756675' '#bdaec0'
  Facet 'M226 86 L213 119 L204 141 L179 157 L163 168 L151 158 L173 137 L204 115 Z' '#a28a9f'
  Ink 'M231 86 Q205 124 159 150 M229 110 Q200 127 157 166 M208 146 L204 122 M181 163 L181 139' '#40383f' '3.5'
  Shape 'M78 204 L97 174 L121 166 L153 172 L174 201 L157 217 L147 232 L128 224 L111 233 L99 215 Z' '#6e6b64'
  Facet 'M109 184 L127 190 L144 183 L141 214 L130 218 L116 212 Z' '#b3a48d'
  Shape 'M90 111 L72 43 L91 57 L108 85 L127 75 L148 83 L170 53 L188 36 L174 110 L173 143 L160 166 L147 182 L123 187 L104 172 L84 144 Z' '#91857d'
  Facet 'M82 60 L96 78 L100 105 L90 105 Z M175 54 L160 80 L157 108 L168 104 Z' '#b19198'
  Facet 'M119 87 L137 85 L158 111 L156 142 L144 165 L126 172 L109 153 L110 115 Z' '#b8aa96'
  Facet 'M87 113 L102 117 L108 146 L122 164 L113 174 L95 159 L86 139 Z M164 107 L172 120 L169 146 L153 169 L144 165 L154 140 Z' '#5f5655'
  Facet 'M93 120 L118 126 L111 142 L96 138 Z M137 126 L164 117 L160 138 L144 142 Z' $I
  Eye 'M101 127 L112 130 L108 136 L100 133 Z M145 130 L156 124 L155 134 L147 136 Z' '#d8b18c'
  Shape 'M111 144 Q130 134 147 145 L151 158 L139 171 L120 173 L105 159 Z' '#958679'
  Facet 'M123 144 L134 144 L137 152 L127 159 L118 151 Z' '#483b3e'
  Facet 'M109 160 Q129 166 147 158 L140 182 L120 181 Z' $I
  Shape 'M113 160 L122 164 L119 184 Z M136 165 L145 160 L139 183 Z' $P
  Ink 'M113 99 L119 106 M138 96 L145 102 M115 201 L120 210 M140 202 L137 212' '#d2c2a4' '3'
) -join "`n"

# Zombie: torn rust shroud, one clouded eye and exposed bone on a sagging face.
$names.zombie = 'Shroud Zombie'; $accent.zombie = '#af7865'
$art.zombie = @(
  Shape 'M26 219 L44 177 L83 159 L102 165 L146 163 L177 157 L213 183 L226 222 L189 227 L165 237 L124 224 L91 238 L63 226 Z' '#68544a'
  Facet 'M43 202 L78 172 L96 191 L77 229 L57 218 Z M160 175 L190 174 L213 202 L195 218 L172 226 Z' '#9d7260'
  Ink 'M79 185 L87 196 L72 215 M185 187 L173 207 L186 215' '#c0977c' '3'
  Shape 'M91 163 L100 131 L151 134 L166 174 L146 210 L110 206 L83 188 Z' '#8d947b'
  Facet 'M132 152 L150 141 L158 176 L138 195 L113 201 L121 176 Z' '#5b6254'
  Ink 'M99 178 L114 187 M132 192 L144 182 M98 165 L111 173' '#c6c1a0' '3'
  Shape 'M82 49 L107 33 L139 35 L164 44 L184 75 L178 109 L187 134 L170 151 L163 181 L144 195 L111 190 L88 166 L76 140 L64 120 L72 91 L68 66 Z' '#979d81'
  Facet 'M106 43 L140 43 L158 55 L163 85 L145 106 L120 101 L107 83 L82 78 L84 56 Z' '#c0bea0'
  Facet 'M162 54 L179 79 L168 117 L173 135 L151 164 L142 190 L122 184 L138 151 L153 115 Z M81 96 L95 114 L90 147 L109 174 L111 188 L89 165 L74 132 Z' '#656f60'
  Shape 'M160 98 L174 111 L183 107 L190 122 L181 139 L165 139 L159 118 Z' '#8a8d74'
  Facet 'M84 98 L112 104 L114 130 L96 139 L79 124 Z' '#544d45'
  Eye 'M89 112 Q100 103 107 115 Q111 128 99 130 Q88 127 89 112 Z' '#d1c9ac'
  Facet 'M133 112 L153 96 L164 105 L159 128 L140 132 Z' $I
  Eye 'M143 117 L157 109 L153 122 L144 126 Z' '#b6c690'
  Facet 'M124 122 L117 145 L132 143 L131 130 Z' '#4d5448'
  Facet 'M88 145 L110 153 L115 179 L100 174 L90 162 Z' '#bb9d80'
  Facet 'M91 150 L107 158 L109 173 L99 169 Z' '#e0d0ac'
  Ink 'M116 160 L143 157 L153 167 L137 174 L111 172' $I '4'
  Ink 'M119 164 L121 173 M131 162 L132 171 M143 162 L141 170' $P '4'
  Ink 'M91 54 L109 62 L106 76 M128 45 L122 56 M152 76 L148 87 M91 88 L97 94' '#555c50' '3'
  Ink 'M77 120 L84 130 M100 142 L107 145 M147 179 L151 173' '#ced0af' '3'
) -join "`n"

# Spider: eight angular articulated legs, plated face, clustered eyes, ivory hooks.
$names.spider = 'Grave Spider'; $accent.spider = '#a58baf'
$art.spider = @(
  Shape 'M98 100 L65 81 L38 26 L28 34 L44 92 L81 129 Z M159 100 L192 80 L219 23 L230 33 L212 94 L175 129 Z' '#756d72'
  Shape 'M91 126 L49 113 L24 76 L16 87 L32 131 L78 152 Z M168 127 L206 113 L231 74 L241 85 L224 133 L177 153 Z' '#8e827f'
  Shape 'M84 152 L36 158 L20 196 L30 205 L48 176 L93 173 Z M172 152 L218 157 L238 195 L228 207 L207 178 L164 174 Z' '#807571'
  Shape 'M95 177 L63 194 L48 229 L60 235 L81 208 L109 195 Z M160 178 L193 195 L208 229 L195 236 L178 209 L148 195 Z' '#8f817a'
  Ink 'M38 42 L54 85 L83 108 M220 42 L202 84 L174 108 M30 97 L41 125 L74 140 M227 99 L215 127 L183 141 M35 190 L44 168 L79 163 M222 191 L212 169 L179 163' '#c8b39a' '3'
  Shape 'M82 83 Q86 49 122 44 Q157 37 176 67 L182 108 L171 134 L96 139 L76 112 Z' '#756f73'
  Facet 'M100 59 L125 49 L153 52 L168 75 L145 94 L115 98 L85 87 Z' '#a09293'
  Facet 'M136 54 L145 90 L174 100 L171 116 L140 128 L128 108 L115 119 L94 127 L79 109 L84 89 L112 101 Z' '#504a52'
  Ink 'M100 74 L119 81 L139 79 L155 68 M104 57 L107 68 M151 99 L165 104' '#c5b399' '3'
  Shape 'M89 114 L117 101 L146 102 L174 119 L180 155 L168 181 L147 198 L124 201 L104 187 L80 164 L77 137 Z' '#a39289'
  Facet 'M113 108 L135 108 L151 123 L153 151 L136 171 L116 167 L101 143 Z' '#c0afa0'
  Facet 'M157 114 L173 130 L174 157 L158 180 L145 193 L135 176 L154 153 Z M89 125 L101 145 L106 172 L122 196 L106 184 L85 161 L84 140 Z' '#645961'
  Facet 'M91 137 L115 142 L111 162 L93 165 L84 151 Z M138 144 L163 134 L172 150 L160 166 L142 163 Z' $I
  Eye 'M94 146 L106 149 L104 157 L94 156 Z M148 148 L160 143 L162 152 L152 158 Z' '#d2b4cd'
  Eye 'M108 121 L115 116 L121 124 L114 131 Z M134 123 L141 115 L148 122 L141 131 Z' '#b99abd'
  Eye 'M94 126 L100 122 L104 128 L98 134 Z M153 126 L159 121 L165 127 L159 133 Z' '#b99abd'
  Facet 'M113 170 L132 162 L150 173 L147 190 L122 195 L107 185 Z' $I
  Shape 'M111 174 Q91 183 97 208 L112 219 L105 203 L121 188 Z M143 174 Q164 182 159 207 L145 219 L150 202 L133 188 Z' '#dccbaa'
  Facet 'M113 180 L107 197 L112 208 L106 203 L103 191 Z M143 180 L152 193 L148 207 L155 197 L150 187 Z' '#a28c75'
  Ink 'M123 174 L129 181 L136 174' '#bd9cae' '3'
) -join "`n"

# Greater slime: three-lobed mineral crown, heavy amber-sage mass, several facets.
$names.slime_large = 'Crowned Slime'; $accent.slime_large = '#acb184'
$art.slime_large = @(
  Shape 'M21 196 Q25 168 45 150 L51 109 Q52 89 73 89 Q75 59 96 48 L108 55 Q123 26 145 35 Q163 41 165 65 Q190 56 205 82 L210 127 Q207 151 229 174 Q241 196 231 214 L210 225 L184 220 L153 237 L122 229 L94 234 L69 221 L40 226 L24 216 Z' '#7c8970' '#d8dcba'
  Facet 'M34 197 L57 161 L63 111 L82 100 L89 71 L104 63 L115 79 L120 111 L107 153 L83 193 L71 212 L48 217 Z' '#b4bea0' '0.76'
  Facet 'M148 46 Q158 58 158 77 L184 72 L198 91 L201 135 L195 154 L224 185 L222 209 L202 214 L179 206 L151 226 L121 219 L140 196 L160 147 L146 107 Z' '#475e50' '0.65'
  Facet 'M105 63 L126 44 L137 40 L135 64 L126 89 L113 93 Z M69 111 L80 102 L88 107 L79 137 L67 143 Z' '#e4e5c2' '0.72'
  Facet 'M82 137 L101 117 L124 131 L121 159 L103 172 L82 158 Z M140 131 L161 114 L182 137 L180 160 L157 171 L140 155 Z' '#2c473d'
  Eye 'M92 139 L105 129 L116 140 L105 159 L94 154 Z M150 138 L163 126 L174 140 L163 157 L152 153 Z' '#dfd6a0'
  Facet 'M105 129 L104 145 L116 140 Z M163 126 L162 143 L174 140 Z' '#faf0c8'
  Ink 'M95 140 L104 145 L105 158 M153 138 L162 143 L163 156' '#7c8d65' '2.5'
  Facet 'M96 184 L118 181 L130 189 L146 180 L164 181 Q155 211 127 215 Q103 211 96 184 Z' '#2f4b3e'
  Facet 'M111 186 L118 191 L113 200 Z M144 188 L154 185 L148 200 Z' '#c6cf9e'
  Ink 'M43 204 L66 212 M171 208 L187 200 L205 209 M91 218 L111 215' '#d4d8b2' '3.5'
  Facet 'M158 77 L167 68 L177 81 L169 94 L160 90 Z M77 180 L86 168 L95 179 L87 192 Z' '#cdd8b2' '0.45'
  Ink 'M133 83 L143 97 L136 117 M190 113 L185 137 M70 153 L65 175' '#9ab28d' '3' '0.7'
) -join "`n"

# Ghoul: swept-back bony ears, hungry stretched jaw, pale mane and hunched shoulders.
$names.ghoul = 'Grave Ghoul'; $accent.ghoul = '#9da88a'
$art.ghoul = @(
  Shape 'M23 220 L43 177 L71 164 L80 137 L108 166 L143 169 L178 140 L188 171 L217 183 L234 220 L204 230 L177 220 L144 238 L117 225 L90 235 L58 224 Z' '#5e685b'
  Facet 'M50 191 L77 174 L95 193 L82 221 L62 216 Z M174 176 L202 192 L217 217 L190 220 L166 204 Z' '#9ca487'
  Ink 'M53 203 L69 191 M64 213 L76 201 M185 195 L201 210 M165 213 L176 221' '#d0cfac' '3'
  Shape 'M89 160 L103 124 L150 123 L171 170 L147 204 L118 208 L97 194 Z' '#9ca78a'
  Facet 'M143 146 L160 173 L145 194 L123 203 L126 174 Z' '#697661'
  Shape 'M79 96 L38 70 L50 116 L78 145 Z M170 95 L215 64 L207 112 L179 146 Z' '#959d84'
  Facet 'M48 81 L72 102 L74 126 L57 110 Z M204 78 L180 103 L181 128 L199 109 Z' '#626e5e'
  Shape 'M79 55 L104 36 L130 41 L154 35 L176 62 L175 102 L168 134 L176 157 L158 187 L133 208 L110 201 L84 174 L81 146 L71 118 L72 82 Z' '#b6b99a'
  Facet 'M109 47 L132 51 L150 43 L165 67 L155 95 L134 111 L115 95 L83 86 L85 63 Z' '#d8d4b0'
  Facet 'M165 66 L170 93 L160 124 L165 157 L149 184 L130 200 L124 178 L143 149 L148 115 Z M79 93 L95 112 L92 140 L110 169 L108 186 L87 168 L84 139 L75 116 Z' '#77816b'
  Facet 'M83 104 L115 114 L108 137 L87 135 L78 121 Z M137 113 L168 101 L172 118 L156 137 L141 133 Z' $I
  Eye 'M90 117 L107 120 L101 127 L88 125 Z M145 119 L160 112 L158 123 L147 127 Z' '#c9d69f'
  Facet 'M125 119 L115 147 L128 143 L138 146 L133 127 Z' '#5e6855'
  Shape 'M99 151 Q125 156 155 148 L159 168 L145 191 L122 196 L99 178 Z' '#51574a'
  Facet 'M104 158 Q129 165 152 153 L148 177 L133 188 L118 184 L108 174 Z' $I
  Shape 'M105 156 L119 160 L113 183 Z M138 159 L151 153 L143 181 Z' '#e8daba'
  Ink 'M122 186 L124 177 M134 184 L136 177' '#c8b496' '4'
  Ink 'M92 58 L105 64 M138 64 L150 57 M100 82 L108 94 M149 80 L143 95 M92 148 L102 143' '#717964' '3'
  Ink 'M107 213 L118 220 M148 213 L139 222' '#cac6a4' '3'
) -join "`n"

# Crawler: blind armored worm rearing upright, segmented neck and mandibles.
$names.crawler = 'Crypt Crawler'; $accent.crawler = '#b38a68'
$art.crawler = @(
  Shape 'M48 223 L62 201 L69 169 L80 133 L101 118 L144 118 L169 139 L181 170 L204 199 L219 221 L190 231 L165 224 L133 238 L105 229 L75 233 Z' '#8b765e'
  Facet 'M140 132 L162 147 L173 182 L198 214 L171 218 L143 231 L119 221 L136 196 Z' '#554e43'
  Shape 'M65 203 L79 183 L106 182 L134 194 L163 183 L189 196 L190 210 L165 226 L134 218 L108 222 L84 214 Z' '#b2a082'
  Facet 'M79 202 L109 207 L131 200 L132 214 L108 217 L85 210 Z M147 201 L176 196 L183 205 L163 218 L144 215 Z' '#7d6954'
  Shape 'M75 168 L88 147 L118 147 L138 159 L160 151 L176 165 L175 186 L154 201 L131 188 L110 197 L86 183 Z' '#b9a68b'
  Facet 'M90 161 L116 157 L131 166 L126 181 L108 188 L86 177 Z M143 170 L164 161 L169 180 L153 192 L139 184 Z' '#806c58'
  Ink 'M96 163 L119 168 M94 207 L115 210 M155 210 L169 204 M147 179 L158 176' '#e0c9a5' '3'
  Shape 'M86 127 L57 105 L39 75 L59 80 L91 103 Z M166 120 L193 91 L213 74 L205 111 L181 135 Z' '#a8997f'
  Facet 'M50 85 L63 100 L87 115 M205 88 L193 110 L177 124' '#cbb693'
  Shape 'M91 46 L116 29 L146 34 L169 55 L186 87 L178 119 L164 150 L142 169 L113 164 L87 148 L73 119 L75 82 Z' '#ac9577'
  Facet 'M113 36 L133 42 L153 40 L169 66 L158 88 L130 97 L112 85 L88 83 L94 57 Z' '#d0ba92'
  Facet 'M166 66 L180 87 L172 117 L154 144 L142 157 L131 143 L145 110 L146 92 Z M81 91 L103 101 L101 131 L119 153 L111 158 L87 140 L79 116 Z' '#73604e'
  Ink 'M104 53 L122 65 L142 63 L155 55 M92 72 L109 80 M149 82 L162 75' '#78634d' '3.5'
  Facet 'M90 102 L114 100 L116 119 L102 132 L85 120 Z M139 105 L166 94 L172 112 L151 130 L138 123 Z' $I
  Eye 'M98 109 L109 108 L107 117 L98 119 Z M147 109 L161 103 L161 112 L150 119 Z' '#ddc690'
  Facet 'M111 132 L130 122 L149 132 L144 153 L122 160 L106 146 Z' '#38352c'
  Shape 'M107 130 Q80 135 79 163 L91 184 L91 161 L121 145 Z' '#ddc39b'
  Shape 'M146 130 Q174 133 176 160 L164 185 L163 162 L132 145 Z' '#cbb08a'
  Facet 'M111 137 L93 151 L89 164 L87 155 L97 139 Z M145 138 L163 151 L165 165 L168 155 L157 141 Z' '#9b7d5e'
  Ink 'M122 137 L127 143 L134 136 M126 155 L131 149' '#b99c74' '3'
) -join "`n"

# Bone archer: deep sage hood framing a skull, diagonal quiver and a tall wood bow.
$names.bone_archer = 'Hooded Bone Archer'; $accent.bone_archer = '#88957b'
$art.bone_archer = @(
  Shape 'M40 193 L34 76 L42 59 L54 65 L66 178 Z' '#6e6657'
  Ink 'M43 76 L54 174 M38 87 L52 80 M39 101 L54 94' '#c5b292' '3'
  Shape 'M55 70 L40 56 L36 35 L47 39 L56 53 L54 33 L64 45 L68 66 Z' '#b1aa8e'
  Shape 'M38 219 L57 178 L90 159 L150 161 L187 181 L205 219 L176 229 L143 235 L111 225 L80 233 Z' '#66715e'
  Facet 'M58 188 L79 176 L96 193 L85 221 L67 225 L51 215 Z M151 177 L174 183 L190 210 L177 223 L148 216 Z' '#93a085'
  Facet 'M99 181 L127 184 L150 178 L142 213 L129 231 L113 218 Z' '#444b40'
  Ink 'M74 190 L68 208 M165 195 L179 210 M105 203 L99 218' '#c8c6a4' '3'
  Shape 'M70 112 Q64 70 91 43 L119 26 L147 33 Q181 52 184 91 L176 137 L154 173 L99 175 L78 150 Z' '#6c7866'
  Facet 'M83 80 L97 51 L122 35 L145 42 L156 63 L132 57 L109 74 L94 117 L87 144 L75 124 Z' '#a1ad91'
  Facet 'M149 45 L172 69 L177 101 L168 130 L151 150 L142 122 L151 89 L142 65 Z' '#424e43'
  Shape 'M98 76 L126 60 L150 74 L162 100 L157 131 L145 158 L129 176 L107 165 L91 142 L85 109 Z' '#bfaf8f'
  Facet 'M113 75 L129 69 L144 79 L150 101 L132 111 L111 99 L94 101 L98 86 Z' '#e0d1ad'
  Facet 'M148 88 L155 104 L148 130 L142 157 L129 169 L128 133 L139 116 Z' '#8b7d66'
  Facet 'M94 107 L118 113 L114 134 L96 133 L90 121 Z M131 111 L153 101 L153 125 L139 134 L130 130 Z' $I
  Eye 'M100 116 L112 119 L108 126 L99 126 Z M135 119 L146 112 L146 123 L138 126 Z' '#c1c895'
  Facet 'M124 128 L115 145 L126 141 L134 145 Z' '#4a483c'
  Facet 'M107 151 L138 148 L136 161 L123 168 L112 160 Z' $I
  Ink 'M113 153 L115 160 M124 153 L124 163 M133 152 L131 159' $P '4'
  Ink 'M113 88 L125 95 L121 105 M161 66 L165 80 M78 146 L89 157' '#655e4f' '3'
  Shape 'M206 31 C174 80 178 156 216 226 L227 224 C193 155 193 83 216 35 Z' '#a68b64'
  Facet 'M209 48 Q188 113 205 173 L219 213 L214 214 Q180 143 203 67 Z' '#d8bd8d'
  Ink 'M211 35 L221 224' '#e0d0ac' '2.5'
  Shape 'M192 132 L211 134 L212 153 L196 153 Z' '#595646'
  Ink 'M195 138 L209 140 M197 146 L210 148' '#c7b58b' '3'
  Ink 'M75 216 L208 99' '#c5b18d' '4'
  Shape 'M206 103 L210 86 L195 93 Z' '#c9c9b1'
) -join "`n"

# Mud golem: broad clay shoulders, moss-lined planes and a sunken primitive face.
$names.mud_golem = 'Mire Golem'; $accent.mud_golem = '#8a9771'
$art.mud_golem = @(
  Shape 'M24 214 L31 175 L61 151 L86 153 L99 128 L155 129 L176 151 L202 148 L227 174 L235 212 L213 229 L179 224 L156 236 L126 227 L94 237 L64 223 L42 230 Z' '#8d8065'
  Facet 'M33 187 L61 160 L83 163 L96 185 L73 214 L47 220 L29 212 Z M171 163 L197 156 L219 180 L229 207 L204 215 L178 200 Z' '#b2a182'
  Facet 'M98 173 L132 151 L168 174 L158 209 L130 227 L100 215 L86 193 Z' '#69674f'
  Facet 'M106 176 L129 162 L149 178 L136 200 L113 199 Z' '#a39a77'
  Ink 'M49 179 L61 190 L58 205 M191 175 L183 185 L192 203 M108 212 L115 221' '#4e4b3a' '4'
  Shape 'M81 51 L105 35 L131 40 L154 32 L175 54 L187 86 L179 116 L187 141 L166 166 L145 185 L113 188 L88 174 L71 147 L76 123 L67 97 L72 70 Z' '#a79a7a'
  Facet 'M90 61 L108 44 L133 48 L152 41 L167 63 L155 85 L137 91 L113 80 L82 86 Z' '#d0bf9a'
  Facet 'M157 84 L175 72 L180 97 L170 119 L179 140 L161 158 L144 177 L128 175 L130 145 L143 123 Z' '#736b51'
  Facet 'M81 90 L107 99 L104 124 L93 133 L104 157 L113 179 L91 166 L79 145 L82 120 L73 100 Z' '#827658'
  Facet 'M88 96 L117 106 L112 125 L92 129 L81 116 Z M136 104 L167 90 L176 108 L158 126 L137 124 Z' '#383d31'
  Eye 'M94 110 L111 112 L107 121 L93 120 Z M143 112 L162 101 L163 111 L147 120 Z' '#c0ce92'
  Facet 'M125 111 L114 140 L126 147 L140 137 L131 119 Z' '#bfb08a'
  Facet 'M122 117 L126 137 L138 135 L129 145 L117 139 Z' '#8b7e5e'
  Facet 'M99 153 L121 157 L144 150 L160 148 L150 164 L130 174 L109 168 Z' '#494b37'
  Ink 'M108 158 L126 164 L148 156' '#d0bc90' '3'
  Facet 'M76 72 L85 61 L101 64 L97 77 L86 81 Z M149 42 L168 55 L162 65 L150 60 Z M170 138 L179 143 L167 158 L156 162 L155 152 Z M62 210 L77 215 L84 226 L71 225 Z' '#7c9066'
  Ink 'M101 53 L114 63 L109 75 M148 73 L140 83 M88 139 L96 145 M145 183 L155 190' '#60583f' '3.5'
  Ink 'M88 66 L91 70 M161 149 L171 145 M66 216 L73 219' '#b3be88' '3'
) -join "`n"

# Cave troll: enormous brows and nose, chipped tusks, stone-grey skin, fur mantle.
$names.cave_troll = 'Cave Troll'; $accent.cave_troll = '#a1a48b'
$art.cave_troll = @(
  Shape 'M17 216 L37 177 L58 165 L64 146 L90 160 L108 172 L150 169 L181 147 L192 167 L216 181 L239 219 L204 224 L182 239 L156 227 L129 236 L100 227 L69 237 L49 224 Z' '#676b5e'
  Facet 'M35 202 L60 175 L82 178 L89 197 L69 222 L44 217 Z M171 178 L194 174 L220 205 L206 216 L187 224 L164 207 Z' '#9da18c'
  Ink 'M50 203 L63 185 M69 212 L77 196 M182 192 L198 213 M170 212 L181 220' '#d2c9aa' '4'
  Shape 'M94 156 L95 127 L154 123 L172 171 L149 205 L120 213 L90 190 Z' '#929784'
  Facet 'M128 165 L153 147 L162 174 L143 197 L119 206 L111 193 Z' '#6e7867'
  Shape 'M75 86 L45 72 L43 102 L62 127 L82 133 Z M175 86 L208 72 L215 97 L195 122 L176 133 Z' '#a9ac94'
  Facet 'M53 86 L68 100 L70 117 L58 108 Z M203 85 L188 101 L185 117 L201 103 Z' '#737d6a'
  Shape 'M75 52 L101 32 L134 30 L165 44 L182 72 L179 110 L188 133 L176 161 L153 191 L124 203 L94 187 L73 161 L64 130 L73 106 L67 80 Z' '#b0b29a'
  Facet 'M92 50 L115 39 L143 42 L159 56 L168 77 L145 88 L126 82 L109 86 L80 77 Z' '#d3ceb0'
  Facet 'M169 65 L176 87 L168 111 L178 133 L166 157 L147 181 L127 195 L120 176 L137 145 L151 122 Z M79 91 L99 108 L91 127 L96 153 L110 184 L94 174 L80 155 L72 129 Z' '#7c8572'
  Shape 'M79 90 L94 84 L122 99 L117 111 L92 108 L78 116 Z M133 99 L160 84 L176 89 L178 112 L160 106 L138 112 Z' '#999d85'
  Facet 'M88 111 L113 111 L110 128 L92 131 L82 123 Z M142 111 L167 105 L173 120 L157 132 L143 127 Z' $I
  Eye 'M93 116 L108 117 L104 123 L94 123 Z M148 116 L162 112 L164 120 L153 124 Z' '#dbcfa0'
  Shape 'M113 103 L136 100 L148 124 L150 142 L136 153 L113 149 L102 135 Z' '#b8b69b'
  Facet 'M125 110 L136 109 L143 132 L131 137 L111 132 L115 116 Z' '#d4ceb0'
  Facet 'M110 139 L120 136 L123 144 L113 146 Z M134 140 L144 135 L145 143 L137 147 Z' '#5b6251'
  Facet 'M91 156 Q124 170 162 151 L157 177 L134 187 L110 181 Z' '#414639'
  Shape 'M95 162 L108 168 L103 146 L91 140 Z M148 168 L161 161 L169 140 L154 147 Z' '#e3d4b0'
  Ink 'M119 178 L121 168 M133 177 L135 168' '#c9b694' '5'
  Ink 'M96 63 L107 72 M151 55 L143 64 M86 139 L92 142 M159 142 L165 136' '#717b66' '3.5'
) -join "`n"

# Orc: swept-back ears, hard cheek planes, iron brow strap and asymmetrical tusks.
$names.orc = 'Ironjaw Orc'; $accent.orc = '#aa7860'
$art.orc = @(
  Shape 'M25 220 L42 180 L76 166 L99 174 L151 173 L177 165 L214 184 L231 220 L200 233 L170 227 L144 237 L117 228 L87 237 L60 225 Z' '#5e6653'
  Shape 'M34 202 L51 178 L78 169 L100 193 L87 213 L61 223 Z' '#8b7f66'
  Facet 'M41 201 L61 183 L76 178 L89 192 L81 204 L61 213 Z' '#bcaa89'
  Ink 'M54 193 L66 204 M76 184 L81 190' '#555246' '3'
  Shape 'M173 175 L199 179 L219 207 L206 222 L180 217 L159 196 Z' '#8a6a54'
  Facet 'M183 182 L195 185 L213 208 L203 213 L181 203 L170 193 Z' '#b88a6a'
  Shape 'M91 169 L103 130 L154 134 L171 176 L148 209 L119 214 L94 198 Z' '#8e9a73'
  Facet 'M142 154 L159 173 L142 197 L122 206 L127 182 Z' '#5d6e52'
  Shape 'M79 94 L33 65 L44 104 L72 132 Z M175 93 L218 62 L211 101 L183 132 Z' '#8d9c71'
  Facet 'M47 78 L71 100 L70 115 L54 101 Z M205 78 L182 99 L183 116 L199 100 Z' '#566b4d'
  Shape 'M76 53 L102 34 L134 36 L159 40 L179 65 L183 96 L174 124 L182 148 L165 177 L140 194 L112 193 L86 173 L74 145 L80 121 L69 94 L70 70 Z' '#a4ad81'
  Facet 'M91 53 L110 42 L136 44 L154 51 L166 70 L146 88 L122 80 L101 86 L79 73 Z' '#c7c7a0'
  Facet 'M169 65 L177 91 L164 123 L170 145 L155 166 L139 184 L127 179 L138 149 L149 123 Z M80 90 L103 108 L97 134 L109 172 L112 184 L91 168 L83 143 L87 121 L75 103 Z' '#6d7c59'
  Shape 'M75 73 L92 65 L108 70 L132 66 L151 72 L174 70 L179 82 L155 85 L130 79 L106 83 L87 78 L74 85 Z' '#6b6555'
  Facet 'M90 69 L102 73 L125 70 L128 76 L105 78 L90 74 Z M137 72 L150 77 L168 75 L169 80 L154 80 Z' '#bab391'
  Facet 'M83 104 L115 112 L109 135 L87 132 L77 120 Z M136 111 L169 97 L177 119 L157 133 L139 129 Z' $I
  Eye 'M91 116 L108 119 L104 126 L91 125 Z M146 117 L161 110 L163 120 L149 127 Z' '#ddb28b'
  Shape 'M117 109 L132 108 L142 135 L130 149 L113 142 L109 131 Z' '#a0a77b'
  Facet 'M116 117 L126 114 L132 134 L116 137 Z' '#c8c99e'
  Ink 'M114 139 L121 140 M132 139 L137 135' '#4b5a3f' '4'
  Facet 'M96 154 L124 162 L160 149 L159 174 L140 181 L115 178 L99 169 Z' '#3b4431'
  Shape 'M98 164 L111 169 L106 146 L97 141 Z M141 170 L155 163 L158 137 L148 145 Z' '#e7d5ad'
  Ink 'M119 172 L120 165 M131 172 L133 164' '#d3bd95' '4'
  Ink 'M155 88 L146 105 L150 129 M103 54 L111 60 M95 145 L101 148' '#657451' '3'
  Ink 'M113 218 L123 226 M144 216 L137 226' '#b8b28b' '3'
) -join "`n"

# Wraith: split violet cowl and rising wisps, not a generic skull emblem.
$names.wraith = 'Veil Wraith'; $accent.wraith = '#a393ba'
$art.wraith = @(
  Shape 'M51 163 Q37 142 39 112 L24 137 Q18 165 38 187 L24 219 L58 205 L77 228 L99 218 L122 239 L141 221 L166 233 L185 210 L222 222 L207 189 Q235 161 231 131 L216 115 Q218 147 198 159 L174 156 L153 172 L101 174 L77 153 Z' '#554e64' '#b9aec9'
  Facet 'M33 155 Q36 176 52 184 L41 207 L63 197 L76 212 L90 190 L104 206 L119 229 L125 204 L102 180 L81 172 L60 177 Z M218 140 Q220 172 195 184 L211 209 L184 195 L163 220 L153 198 L174 177 L198 174 Z' '#8e819e' '0.9'
  Facet 'M76 196 L88 181 L107 197 L127 230 L116 231 L96 211 L86 216 Z M142 222 L148 198 L166 184 L180 191 L160 220 Z' '#b2a2b7'
  Shape 'M66 116 L78 74 L96 50 L128 27 L158 45 L178 69 L190 112 L180 145 L166 171 L141 186 L113 184 L86 165 L70 144 Z' '#71657f' '#cabbd3'
  Facet 'M84 76 L106 51 L129 36 L145 48 L127 63 L106 74 L94 100 L79 130 L75 139 L73 113 Z' '#ac9eb7'
  Facet 'M151 49 L171 74 L181 111 L172 144 L156 163 L145 135 L158 107 L149 75 L136 64 Z' '#494253'
  Shape 'M104 79 L126 63 L147 77 L159 106 L151 142 L136 171 L119 171 L100 146 L91 111 Z' '#b0aaa5' '#ded2c5'
  Facet 'M110 84 L127 72 L140 83 L142 102 L125 119 L109 112 L99 109 Z' '#ddd3bb'
  Facet 'M146 90 L153 109 L144 140 L133 161 L124 165 L124 143 L134 119 Z' '#777182'
  Facet 'M96 110 L119 119 L112 141 L99 136 L91 122 Z M132 119 L154 105 L158 120 L146 141 L134 137 Z' '#302d3c'
  Eye 'M102 121 L113 126 L110 132 L101 131 Z M137 123 L149 115 L148 127 L139 133 Z' '#d4c5ee'
  Facet 'M125 132 L115 152 L125 146 L133 153 Z' '#5d556a'
  Facet 'M114 158 L129 161 L140 152 L131 172 L121 178 Z' '#393241'
  Ink 'M118 158 L120 167 M130 159 L127 169' '#c5b7c9' '3'
  Ink 'M89 151 L101 164 M161 149 L150 167 M86 87 L95 75 M166 91 L171 110 M58 188 L65 183' '#cec0d1' '3'
  Ink 'M76 127 L85 107 M180 129 L174 143 M149 189 L141 210 M108 189 L120 207' '#a596b6' '3.5'
) -join "`n"

# Necromancer: angular living face, violet ceremonial hood, bone clasp and staff.
$names.necromancer = 'Ash Necromancer'; $accent.necromancer = '#9d83ad'
$art.necromancer = @(
  Shape 'M29 221 L49 182 L78 162 L99 174 L154 170 L182 160 L211 185 L232 220 L196 229 L175 223 L149 237 L120 229 L89 237 L60 226 Z' '#675b72' '#b5a0bc'
  Facet 'M52 186 L77 173 L102 191 L90 221 L67 225 L43 216 Z M157 181 L181 171 L202 191 L220 214 L197 219 L171 214 Z' '#9782a2'
  Facet 'M103 185 L126 195 L151 179 L146 218 L133 233 L115 220 Z' '#423b4c'
  Ink 'M65 191 L74 199 L65 215 M183 189 L179 201 L190 213' '#c2adc5' '3'
  Shape 'M97 152 L99 132 L149 127 L161 167 L142 189 L119 193 L98 175 Z' '#a6a18f'
  Facet 'M142 139 L153 163 L137 180 L122 186 L122 164 Z' '#6f7168'
  Shape 'M73 117 L71 79 L90 51 L124 27 L156 41 L178 69 L183 105 L173 142 L155 169 L101 172 L80 146 Z' '#71617f' '#c4aecb'
  Facet 'M83 81 L99 57 L124 37 L144 47 L127 60 L106 73 L95 103 L85 141 L79 131 L78 108 Z' '#ad96b7'
  Facet 'M149 48 L171 75 L176 103 L165 138 L153 154 L143 124 L153 93 L140 67 Z' '#493e56'
  Shape 'M101 81 L125 64 L146 79 L156 104 L151 132 L140 156 L124 171 L108 163 L96 143 L91 112 Z' '#b9b4a0'
  Facet 'M111 82 L126 73 L139 85 L143 103 L127 115 L109 102 L99 105 Z' '#dfd7bc'
  Facet 'M146 93 L150 109 L141 133 L140 152 L127 163 L119 152 L129 125 L138 113 Z' '#7f8174'
  Facet 'M96 112 L116 116 L112 132 L99 131 L93 120 Z M132 116 L150 106 L156 119 L143 132 L134 129 Z' '#393740'
  Eye 'M101 119 L111 121 L108 127 L101 126 Z M137 119 L147 113 L148 123 L140 127 Z' '#d4bdea'
  Facet 'M124 117 L117 143 L129 139 L132 132 Z' '#6b6b61'
  Ink 'M110 146 L124 150 L140 141 M117 157 L128 158 L135 151' '#514f4b' '3.5'
  Ink 'M110 89 L121 97 M133 89 L140 94 M98 136 L107 139' '#7c7a6d' '3'
  Shape 'M120 194 L131 186 L143 194 L141 209 L130 215 L120 208 Z' '#c8b795'
  Facet 'M124 196 L129 200 L127 205 L123 203 Z M133 200 L138 195 L139 203 L134 206 Z M130 204 L127 209 L133 209 Z' '#494049'
  Ink 'M85 156 L101 174 L119 194 M157 157 L147 176 L138 193' '#b6a27f' '3'
  Shape 'M211 91 L221 89 L226 230 L215 233 Z' '#76644c'
  Ink 'M216 105 L221 220' '#c0a583' '3'
  Shape 'M219 35 L238 62 L232 87 L215 99 L199 79 L201 56 Z' '#9b86ad' '#d5c2df'
  Facet 'M218 45 L225 63 L216 83 L207 76 L208 60 Z' '#d6c2df'
  Facet 'M225 63 L232 64 L226 83 L217 91 L216 83 Z' '#655173'
  Ink 'M204 96 L230 92 M211 101 L229 99' '#b8a383' '4'
) -join "`n"

# Rock sovereign: massive faceted stone head, broken obelisks and an inset rune.
$names.boss_rock = 'Rune-Cracked Sovereign'; $accent.boss_rock = '#a4c5ae'
$art.boss_rock = @(
  Shape 'M15 211 L25 174 L52 156 L73 160 L83 136 L175 135 L191 160 L209 153 L232 175 L243 212 L224 228 L192 225 L168 239 L132 228 L99 238 L67 225 L36 232 Z' '#73766a'
  Facet 'M24 190 L52 164 L72 169 L91 192 L74 216 L43 223 L20 211 Z M173 182 L191 169 L209 163 L229 185 L236 208 L215 220 L186 213 Z' '#b4b39a'
  Facet 'M101 168 L133 151 L162 170 L173 199 L147 224 L119 220 L91 201 Z' '#929781'
  Ink 'M49 175 L58 187 L48 200 L62 214 M205 178 L194 192 L207 207 M116 193 L127 203 L123 216' '#3a4037' '4.5'
  Ink 'M51 180 L57 189 L51 199 M199 193 L205 203' '#a4c5ae' '2.5'
  Shape 'M71 74 L46 53 L50 22 L74 35 L86 62 Z' '#999983'
  Facet 'M55 33 L68 41 L77 61 L70 65 L55 50 Z' '#d0c6a5'
  Shape 'M170 63 L181 31 L203 17 L211 46 L190 75 Z' '#a4a28b'
  Facet 'M186 37 L198 29 L204 44 L188 61 L179 61 Z' '#d4c8a9'
  Shape 'M74 57 L102 39 L131 45 L153 33 L177 53 L190 81 L178 107 L193 133 L175 164 L152 186 L127 202 L101 188 L80 173 L65 143 L75 117 L64 87 Z' '#a4a28b'
  Facet 'M84 62 L105 49 L131 54 L154 43 L172 59 L161 81 L139 94 L111 83 L76 88 Z' '#d6c9a9'
  Facet 'M169 69 L182 82 L169 110 L183 134 L166 156 L144 178 L126 193 L122 166 L141 138 L149 112 Z M75 96 L102 107 L95 130 L105 158 L116 185 L89 166 L74 142 L83 120 Z' '#727965'
  Facet 'M80 103 L116 113 L110 134 L87 136 L73 120 Z M138 112 L172 97 L184 119 L165 138 L141 132 Z' '#303b31'
  Eye 'M89 115 L109 120 L105 128 L89 127 Z M147 119 L165 110 L169 121 L153 131 Z' '#bbddad'
  Facet 'M124 114 L112 144 L129 152 L144 140 L135 123 Z' '#c6b897'
  Facet 'M132 123 L135 140 L144 140 L129 150 L119 142 Z' '#8a8d72'
  Facet 'M94 158 L122 164 L156 150 L166 156 L151 172 L126 182 L108 175 Z' '#404a3b'
  Ink 'M104 164 L125 172 L150 160' '#bcbb95' '4'
  Ink 'M120 49 L113 65 L124 77 L120 99 M152 43 L143 61 L149 75 M86 139 L98 147 L93 161 M162 141 L155 150 L164 158' '#394337' '5'
  Eye 'M127 57 L138 70 L129 83 L117 71 Z' '#b9d7a8'
  Facet 'M127 61 L127 77 L121 71 Z' '#eff0c3'
  Ink 'M126 83 L123 94 M113 66 L116 72 M144 62 L147 71 M98 148 L96 157 M156 151 L161 156' '#a7cc9d' '2.5'
  Ink 'M83 70 L96 76 M160 87 L169 81 M118 185 L123 190' '#e1d2b0' '3'
) -join "`n"

# Dragon: tall S-curved scaled neck, broad brow horns, layered jaw and teeth.
$names.boss_dragon = 'Cinder Dragon'; $accent.boss_dragon = '#ba8168'
$art.boss_dragon = @(
  Shape 'M68 226 L82 184 L96 152 L145 125 L168 149 L166 178 L181 203 L211 222 L188 236 L161 228 L137 239 L105 229 L86 236 Z' '#91735e'
  Facet 'M123 149 L148 144 L154 169 L143 193 L161 219 L182 231 L159 231 L136 230 L115 215 L112 188 Z' '#c0ad88'
  Facet 'M91 185 L104 161 L126 150 L117 185 L118 211 L133 233 L111 226 L82 226 Z M153 177 L164 185 L171 201 L198 221 L182 225 L157 207 L146 191 Z' '#604f42'
  Ink 'M116 165 L143 171 M112 183 L138 190 M113 202 L143 209 M124 220 L155 226' '#78634e' '4'
  Shape 'M90 174 L69 165 L71 184 L83 195 Z M82 199 L58 197 L68 216 L78 217 Z M169 175 L186 160 L184 185 L172 194 Z M181 203 L205 190 L199 212 L192 217 Z' '#aa9574'
  Shape 'M75 78 C48 72 34 49 37 20 Q49 41 68 44 L89 62 Z' '#a69474'
  Facet 'M43 35 Q53 54 75 58 L81 68 Q55 65 45 48 Z' '#dfc9a0'
  Shape 'M166 70 Q191 49 197 20 L209 30 Q217 67 185 91 Z' '#b4a180'
  Facet 'M200 31 Q200 57 179 76 L185 79 Q209 62 206 40 Z' '#e2c9a0'
  Shape 'M88 61 L103 37 L118 51 L137 32 L149 53 L171 49 L185 74 L179 101 L197 120 L213 148 L204 169 L180 185 L150 185 L131 174 L104 174 L84 151 L73 124 L78 94 L70 79 Z' '#9c7c65'
  Facet 'M91 68 L103 48 L116 62 L139 45 L143 64 L164 60 L173 78 L151 96 L130 91 L107 97 L80 85 Z' '#c3a37f'
  Facet 'M164 80 L177 79 L169 101 L181 120 L196 137 L184 151 L155 140 L145 116 L149 100 Z M82 96 L107 108 L101 130 L114 155 L126 168 L105 166 L90 146 L80 125 Z' '#69523f'
  Shape 'M80 94 L102 84 L126 103 L121 116 L100 108 L80 116 Z M139 102 L159 85 L177 88 L182 104 L159 111 L145 115 Z' '#b69977'
  Facet 'M86 115 L117 119 L110 139 L90 136 L79 127 Z M146 117 L176 108 L183 123 L164 141 L148 135 Z' $I
  Eye 'M92 122 L111 125 L106 134 L93 132 Z M153 122 L169 115 L172 124 L159 135 Z' '#edc28b'
  Ink 'M103 124 L103 132 M163 120 L162 130' '#60452f' '3'
  Shape 'M112 134 L138 124 L158 132 L175 132 L195 144 L200 157 L187 172 L163 175 L143 164 L120 163 L105 152 Z' '#b69473'
  Facet 'M131 135 L148 136 L162 145 L187 146 L192 155 L178 161 L155 155 L137 153 L119 154 L114 146 Z' '#d7b68b'
  Facet 'M125 145 L136 139 L139 146 L133 151 Z M170 145 L181 146 L184 153 L173 154 Z' '#4a3b30'
  Facet 'M112 160 L140 166 L161 177 L194 162 L194 177 L174 190 L151 192 L134 179 L113 175 Z' '#392e28'
  Shape 'M118 164 L129 166 L125 183 Z M141 173 L152 177 L147 194 Z M171 173 L183 167 L175 187 Z M187 166 L195 160 L190 178 Z' '#e4ceaa'
  Ink 'M106 70 L116 78 L128 70 M134 59 L142 69 L153 64 M86 139 L96 147 L103 140 M160 78 L164 85' '#574333' '3'
  Ink 'M93 202 L101 209 L108 201 M94 183 L104 190 M165 206 L172 212' '#bc9975' '3'
) -join "`n"

# Final monarch: void-black demonic mask, asymmetric crown, bone horns and mantle.
$names.boss_final = 'The Hollow Monarch'; $accent.boss_final = '#b69bbf'
$art.boss_final = @(
  Shape 'M18 217 L37 177 L67 151 L89 166 L112 179 L144 176 L175 151 L203 166 L237 216 L208 229 L179 224 L151 239 L127 229 L99 238 L71 224 L43 231 Z' '#514858' '#bba9c4'
  Facet 'M35 200 L65 164 L82 176 L95 198 L76 218 L48 222 Z M174 166 L193 177 L222 211 L203 222 L180 211 L161 192 Z' '#9b889d'
  Facet 'M105 188 L129 197 L151 184 L145 218 L128 234 L113 218 Z' '#2c2b35'
  Ink 'M50 198 L64 189 L75 200 M185 188 L177 199 L197 215' '#d6c5ca' '3.5'
  Shape 'M83 101 Q43 94 30 64 L27 39 Q44 64 69 64 L91 84 Z' '#bcad8f'
  Facet 'M35 54 Q48 78 78 84 L80 94 Q49 89 37 67 Z' '#e4d1ad'
  Shape 'M170 99 Q213 91 225 60 L230 35 Q211 61 187 62 L162 82 Z' '#b9ac91'
  Facet 'M221 51 Q208 78 178 82 L175 92 Q208 85 220 64 Z' '#e4d1ad'
  Shape 'M79 84 L105 66 L135 68 L165 74 L182 99 L175 130 L185 146 L168 174 L147 198 L127 212 L108 198 L87 174 L73 148 L83 128 L70 104 Z' '#57505f' '#cdb8ce'
  Facet 'M98 80 L119 75 L135 79 L153 80 L170 101 L152 113 L131 104 L111 110 L80 103 Z' '#a394a0'
  Facet 'M166 100 L173 113 L163 131 L176 148 L160 173 L143 191 L129 202 L127 174 L143 149 L149 120 Z M82 111 L102 123 L96 145 L109 172 L113 193 L96 177 L83 153 L90 132 Z' '#393541'
  Facet 'M81 114 L117 126 L110 150 L88 148 L76 132 Z M137 124 L173 110 L181 129 L163 151 L142 146 Z' '#1b1b25'
  Eye 'M91 128 L110 132 L105 141 L91 138 Z M146 132 L165 121 L168 132 L152 144 Z' '#e2c0e9'
  Facet 'M125 119 L113 155 L124 161 L139 151 L132 129 Z' '#b0a4a6'
  Facet 'M125 130 L124 151 L137 150 L126 160 L118 154 Z' '#706471'
  Facet 'M103 165 L124 172 L150 160 L163 161 L155 181 L136 198 L120 195 L106 182 Z' '#201f29'
  Shape 'M105 168 L117 172 L115 190 Z M146 168 L159 163 L151 185 Z' '#d9c8ad'
  Ink 'M123 188 L124 178 M135 187 L137 175' '#b9a8b8' '4'
  Ink 'M90 151 L102 158 M160 152 L166 146 M109 91 L121 100 M142 89 L151 98' '#dbc4c7' '3'
  Shape 'M78 79 L62 32 L89 49 L103 22 L128 40 L147 17 L166 48 L193 30 L175 80 L149 88 L125 82 L101 88 Z' '#817060' '#d9c7a6'
  Facet 'M72 45 L88 58 L104 34 L114 47 L106 67 L89 73 L80 67 Z M146 30 L158 53 L178 44 L170 67 L151 72 L138 58 Z' '#c7b18b'
  Shape 'M126 48 L138 62 L126 76 L114 63 Z' '#937898' '#d3badd'
  Eye 'M126 54 L132 62 L126 70 L120 63 Z' '#ddbee9'
  Ink 'M81 77 L103 80 M149 80 L173 73' '#e2d0ad' '3'
  Ink 'M127 85 L124 98 L131 112' '#c7a6d0' '2.6'
) -join "`n"

$ids = @('rat','slime','skeleton','bat','zombie','spider','slime_large','ghoul','crawler','bone_archer','mud_golem','cave_troll','orc','wraith','necromancer','boss_rock','boss_dragon','boss_final')
if ($art.Count -ne 18) { throw 'The first batch must contain exactly 18 portraits.' }
$allowed = @('index.json')
foreach ($id in $ids) { $allowed += "$id.png"; $allowed += "$id.svg" }
if (-not $ValidateOnly -and -not (Test-Path -LiteralPath $output)) { [void][System.IO.Directory]::CreateDirectory($output) }
foreach ($entry in Get-ChildItem -LiteralPath $output) {
  if ($entry.PSIsContainer -or $entry.Name -notin $allowed) { throw "Unrelated content in asset output: $($entry.Name)" }
}

if ($ValidateOnly) {
  $hashes = @{}
  foreach ($id in $ids) {
    $png = Join-Path $output "$id.png"; $svgFile = Join-Path $output "$id.svg"
    if (-not (Test-Path -LiteralPath $svgFile)) { throw "Missing SVG for $id" }
    $xml = New-Object System.Xml.XmlDocument
    $xml.XmlResolver = $null
    $xml.Load($svgFile)
    if ($xml.DocumentElement.GetAttribute('viewBox') -ne '0 0 256 256') { throw "Incorrect SVG viewBox for $id" }
    $stats = [MonsterPortraitRasterizer]::Check($png) | ConvertFrom-Json
    if ($hashes.ContainsKey($stats.sha256)) { throw "Duplicate portrait: $id and $($hashes[$stats.sha256])" }
    $hashes[$stats.sha256] = $id
    Write-Output ("{0}: 256x256 RGBA; transparent={1}, partial={2}, opaque={3}; bounds=[{4}]" -f $id, $stats.transparent, $stats.partial, $stats.opaque, ($stats.bounds -join ','))
  }
  $manifest = [System.IO.File]::ReadAllText((Join-Path $output 'index.json')) | ConvertFrom-Json
  if ($manifest.assets.Count -ne 18 -or ($manifest.assets.id -join ',') -ne ($ids -join ',')) { throw 'Manifest IDs do not match the batch.' }
  Write-Output 'PASS: all 18 unique PNG/SVG pairs decode; dimensions, RGBA, alpha, silhouette bounds and manifest verified. No visual review performed.'
  return
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$entries = @()
foreach ($id in $ids) {
  $body = $art[$id]
  # Paths intentionally use only absolute M/L/C/Q/Z commands for portable editing.
  $svg = "<svg xmlns=`"http://www.w3.org/2000/svg`" width=`"256`" height=`"256`" viewBox=`"0 0 256 256`" fill=`"none`" stroke-linecap=`"round`" stroke-linejoin=`"round`" role=`"img`" aria-labelledby=`"title-$id`">`n<title id=`"title-$id`">$($names[$id])</title>`n<desc>Original hand-inked dark-fantasy monster bust; static luminous eyes, faceted parchment shading, transparent silhouette.</desc>`n$body`n</svg>`n"
  [System.IO.File]::WriteAllText((Join-Path $output "$id.svg"), $svg, $utf8)
  [MonsterPortraitRasterizer]::Render($svg, (Join-Path $output "$id.png"))
  $entries += [ordered]@{ id = $id; name = $names[$id]; png = "/static/enemies/$id.png"; svg = "/static/enemies/$id.svg"; width = 256; height = 256; accent = $accent[$id]; boss = $id.StartsWith('boss_') }
  Write-Output "$id : ready, 256x256 RGBA PNG + editable SVG"
}
$manifest = [ordered]@{
  schemaVersion = 1
  collection = 'Original monster portraits - first-stage enemies and three bosses'
  style = 'Charcoal ink; warm bone and stone facets; muted sage, rust and violet; static eye light'
  canvas = [ordered]@{ width = 256; height = 256; background = 'transparent'; pixelFormat = 'RGBA'; supersampling = 4 }
  generator = 'tools/art/monster-portraits.ps1'
  assets = $entries
}
[System.IO.File]::WriteAllText((Join-Path $output 'index.json'), ($manifest | ConvertTo-Json -Depth 6) + "`n", $utf8)
Write-Output 'READY TO INTEGRATE: 18 original portrait pairs and index.json. Run this script with -ValidateOnly for nonvisual checks.'
