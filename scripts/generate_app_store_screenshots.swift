#!/usr/bin/env swift

import AppKit

struct Panel {
    let source: String
    let title: String
    let subtitle: String
}

let projectRoot = FileManager.default.currentDirectoryPath
let sourceRoot = "/Users/shindongheun/Desktop/myProject/스크린샷"
let outputRoot = "\(projectRoot)/output/app-store-screenshots-1.1.0"
let backgroundPath = "\(outputRoot)/connected-background.png"

let panels = [
    Panel(
        source: "Simulator Screenshot - iPhone 17 Pro Max - 2026-09-17 at 02.20.38.png",
        title: "약속 전 남는 시간,\n어디 들러볼까요?",
        subtitle: "시간과 장소만 정하면 코스를 찾아드려요."
    ),
    Panel(
        source: "Simulator Screenshot - iPhone 17 Pro Max - 2026-09-17 at 02.35.34.png",
        title: "남은 시간에 맞는\n장소를 추천해요",
        subtitle: "이동시간과 운영시간을 함께 고려해요."
    ),
    Panel(
        source: "Simulator Screenshot - iPhone 17 Pro Max - 2026-09-17 at 02.35.58.png",
        title: "고른 장소로\n코스를 완성해요",
        subtitle: "최대 두 곳을 연결해 한눈에 확인하세요."
    ),
    Panel(
        source: "Simulator Screenshot - iPhone 17 Pro Max - 2026-09-17 at 02.36.07.png",
        title: "이동부터 머무는 시간까지",
        subtitle: "코스 진행을 한 화면에서 이어가세요."
    ),
    Panel(
        source: "Simulator Screenshot - iPhone 17 Pro Max - 2026-09-17 at 02.30.49.png",
        title: "약속이 없어도\n주변을 둘러보세요",
        subtitle: "선택한 위치에서 가까운 장소를 찾아보세요."
    ),
    Panel(
        source: "Simulator Screenshot - iPhone 17 Pro Max - 2026-09-17 at 02.30.20.png",
        title: "다녀온 장소를\n한눈에 기록해요",
        subtitle: "방문한 장소와 지역을 모아볼 수 있어요."
    ),
]

let canvasSize = NSSize(width: 1320, height: 2868)
let screenRect = NSRect(x: 150, y: 610, width: 1020, height: 2216)

guard let panorama = NSImage(contentsOfFile: backgroundPath) else {
    fatalError("연결 배경을 읽을 수 없습니다: \(backgroundPath)")
}

try FileManager.default.createDirectory(
    atPath: outputRoot,
    withIntermediateDirectories: true
)

func drawText(_ text: String, rect: NSRect, font: NSFont, color: NSColor, lineSpacing: CGFloat = 0) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .left
    paragraph.lineBreakMode = .byWordWrapping
    paragraph.lineSpacing = lineSpacing
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: color,
        .paragraphStyle: paragraph,
    ]
    NSAttributedString(string: text, attributes: attributes).draw(in: rect)
}

func drawAdjustedStatusTime(_ time: String, in screen: NSRect) {
    let coverRect = NSRect(
        x: screen.minX + screen.width * 0.115,
        y: screen.minY + screen.height * 0.010,
        width: screen.width * 0.205,
        height: screen.height * 0.060
    )
    NSColor(calibratedRed: 0.071, green: 0.071, blue: 0.078, alpha: 1).setFill()
    coverRect.fill()
    drawText(
        time,
        rect: NSRect(
            x: screen.minX + screen.width * 0.145,
            y: screen.minY + screen.height * 0.021,
            width: screen.width * 0.17,
            height: screen.height * 0.045
        ),
        font: NSFont.systemFont(ofSize: screen.width * 0.036, weight: .semibold),
        color: .white
    )
}

for (index, panel) in panels.enumerated() {
    guard let screenshot = NSImage(contentsOfFile: "\(sourceRoot)/\(panel.source)") else {
        fatalError("원본 화면을 읽을 수 없습니다: \(panel.source)")
    }

    let output = NSImage(size: canvasSize)
    output.lockFocusFlipped(true)
    guard let context = NSGraphicsContext.current else {
        fatalError("그래픽 컨텍스트를 만들 수 없습니다.")
    }
    context.imageInterpolation = .high

    NSColor(calibratedRed: 0.055, green: 0.059, blue: 0.071, alpha: 1).setFill()
    NSRect(origin: .zero, size: canvasSize).fill()

    let segmentWidth = panorama.size.width / CGFloat(panels.count)
    let sourceRect = NSRect(
        x: segmentWidth * CGFloat(index),
        y: 0,
        width: segmentWidth,
        height: panorama.size.height
    )
    panorama.draw(
        in: NSRect(origin: .zero, size: canvasSize),
        from: sourceRect,
        operation: .sourceOver,
        fraction: 1
    )

    NSColor(calibratedWhite: 0.02, alpha: 0.28).setFill()
    NSRect(origin: .zero, size: canvasSize).fill()

    let accentRect = NSRect(x: 92, y: 103, width: 54, height: 10)
    let accent = NSBezierPath(roundedRect: accentRect, xRadius: 5, yRadius: 5)
    NSColor(calibratedRed: 0.04, green: 0.43, blue: 1, alpha: 1).setFill()
    accent.fill()

    let titleFont = NSFont.systemFont(ofSize: 76, weight: .bold)
    let subtitleFont = NSFont.systemFont(ofSize: 36, weight: .medium)
    let titleLines = panel.title.components(separatedBy: "\n").count
    let titleHeight: CGFloat = titleLines == 1 ? 104 : 202
    drawText(
        panel.title,
        rect: NSRect(x: 92, y: 138, width: 1136, height: titleHeight),
        font: titleFont,
        color: .white,
        lineSpacing: 4
    )
    drawText(
        panel.subtitle,
        rect: NSRect(x: 94, y: 374, width: 1132, height: 58),
        font: subtitleFont,
        color: NSColor(calibratedWhite: 0.83, alpha: 1)
    )

    context.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.72)
    shadow.shadowBlurRadius = 44
    shadow.shadowOffset = NSSize(width: 0, height: 18)
    shadow.set()
    NSColor(calibratedWhite: 0.03, alpha: 1).setFill()
    NSBezierPath(roundedRect: screenRect, xRadius: 58, yRadius: 58).fill()
    context.restoreGraphicsState()

    context.saveGraphicsState()
    NSBezierPath(roundedRect: screenRect, xRadius: 58, yRadius: 58).addClip()
    screenshot.draw(
        in: screenRect,
        from: NSRect(origin: .zero, size: screenshot.size),
        operation: .sourceOver,
        fraction: 1,
        respectFlipped: true,
        hints: [.interpolation: NSImageInterpolation.high.rawValue]
    )
    context.restoreGraphicsState()

    if index == 2 {
        drawAdjustedStatusTime("14:35", in: screenRect)
    } else if index == 3 {
        drawAdjustedStatusTime("14:36", in: screenRect)
    }

    let border = NSBezierPath(roundedRect: screenRect, xRadius: 58, yRadius: 58)
    border.lineWidth = 3
    NSColor(calibratedWhite: 1, alpha: 0.13).setStroke()
    border.stroke()

    output.unlockFocus()

    guard let tiff = output.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let jpeg = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.97]) else {
        fatalError("JPEG 변환에 실패했습니다: \(index + 1)")
    }

    let filename = String(format: "%02d-jjaturi-app-store.jpg", index + 1)
    let outputPath = "\(outputRoot)/\(filename)"
    try jpeg.write(to: URL(fileURLWithPath: outputPath))

    // NSImage는 Retina 환경에서 backing scale을 적용할 수 있으므로 App Store 규격으로 고정한다.
    let resize = Process()
    resize.executableURL = URL(fileURLWithPath: "/usr/bin/sips")
    resize.arguments = ["-z", "2868", "1320", outputPath]
    resize.standardOutput = FileHandle.nullDevice
    resize.standardError = FileHandle.nullDevice
    try resize.run()
    resize.waitUntilExit()
    guard resize.terminationStatus == 0 else {
        fatalError("App Store 규격 변환에 실패했습니다: \(filename)")
    }
    print(filename)
}

// 첫 두 장은 하나의 대표 비주얼로 보이도록 넓은 좌표계를 공유해 다시 만든다.
// 추천 화면이 두 패널의 경계를 넘도록 배치해 App Store 목록에서 연결된 이미지가 된다.
guard let heroMain = NSImage(contentsOfFile: "\(sourceRoot)/\(panels[0].source)"),
      let heroRecommendation = NSImage(contentsOfFile: "\(sourceRoot)/\(panels[1].source)") else {
    fatalError("대표 이미지 원본을 읽을 수 없습니다.")
}

func drawHeroScreenshot(_ image: NSImage, globalRect: NSRect, panelOffsetX: CGFloat) {
    let localRect = NSRect(
        x: globalRect.minX - panelOffsetX,
        y: globalRect.minY,
        width: globalRect.width,
        height: globalRect.height
    )
    guard let context = NSGraphicsContext.current else { return }

    context.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.76)
    shadow.shadowBlurRadius = 52
    shadow.shadowOffset = NSSize(width: 0, height: 20)
    shadow.set()
    NSColor(calibratedWhite: 0.03, alpha: 1).setFill()
    NSBezierPath(roundedRect: localRect, xRadius: 62, yRadius: 62).fill()
    context.restoreGraphicsState()

    context.saveGraphicsState()
    NSBezierPath(roundedRect: localRect, xRadius: 62, yRadius: 62).addClip()
    image.draw(
        in: localRect,
        from: NSRect(origin: .zero, size: image.size),
        operation: .sourceOver,
        fraction: 1,
        respectFlipped: true,
        hints: [.interpolation: NSImageInterpolation.high.rawValue]
    )
    context.restoreGraphicsState()

    let border = NSBezierPath(roundedRect: localRect, xRadius: 62, yRadius: 62)
    border.lineWidth = 3
    NSColor(calibratedWhite: 1, alpha: 0.14).setStroke()
    border.stroke()
}

let heroTitles = [
    ("약속 전 남는 시간,", "그냥 기다리지 마세요."),
    ("부산 한 곳 더", "시간에 맞는 장소와 코스를 추천해요."),
]

for heroIndex in 0..<2 {
    let output = NSImage(size: canvasSize)
    output.lockFocusFlipped(true)
    guard let context = NSGraphicsContext.current else {
        fatalError("대표 이미지 그래픽 컨텍스트를 만들 수 없습니다.")
    }
    context.imageInterpolation = .high

    NSColor(calibratedRed: 0.055, green: 0.059, blue: 0.071, alpha: 1).setFill()
    NSRect(origin: .zero, size: canvasSize).fill()

    let segmentWidth = panorama.size.width / CGFloat(panels.count)
    panorama.draw(
        in: NSRect(origin: .zero, size: canvasSize),
        from: NSRect(
            x: segmentWidth * CGFloat(heroIndex),
            y: 0,
            width: segmentWidth,
            height: panorama.size.height
        ),
        operation: .sourceOver,
        fraction: 1
    )
    NSColor(calibratedWhite: 0.02, alpha: 0.24).setFill()
    NSRect(origin: .zero, size: canvasSize).fill()

    let panelOffsetX = CGFloat(heroIndex) * canvasSize.width
    let accentX: CGFloat = heroIndex == 0 ? 92 : 1440
    let accent = NSBezierPath(
        roundedRect: NSRect(x: accentX - panelOffsetX, y: 103, width: 54, height: 10),
        xRadius: 5,
        yRadius: 5
    )
    NSColor(calibratedRed: 0.04, green: 0.43, blue: 1, alpha: 1).setFill()
    accent.fill()

    let titleX: CGFloat = heroIndex == 0 ? 92 : 1440
    drawText(
        heroTitles[heroIndex].0,
        rect: NSRect(x: titleX - panelOffsetX, y: 140, width: 1120, height: 108),
        font: NSFont.systemFont(ofSize: 76, weight: .bold),
        color: .white
    )
    drawText(
        heroTitles[heroIndex].1,
        rect: NSRect(x: titleX - panelOffsetX, y: 278, width: 1120, height: 58),
        font: NSFont.systemFont(ofSize: 36, weight: .medium),
        color: NSColor(calibratedWhite: 0.84, alpha: 1)
    )

    drawHeroScreenshot(
        heroMain,
        globalRect: NSRect(x: 92, y: 590, width: 970, height: 2107),
        panelOffsetX: panelOffsetX
    )
    drawHeroScreenshot(
        heroRecommendation,
        globalRect: NSRect(x: 1060, y: 470, width: 1160, height: 2520),
        panelOffsetX: panelOffsetX
    )
    drawAdjustedStatusTime(
        "14:35",
        in: NSRect(
            x: 1060 - panelOffsetX,
            y: 470,
            width: 1160,
            height: 2520
        )
    )

    output.unlockFocus()
    guard let tiff = output.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let jpeg = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.97]) else {
        fatalError("대표 이미지 JPEG 변환에 실패했습니다: \(heroIndex + 1)")
    }

    let filename = String(format: "%02d-jjaturi-app-store.jpg", heroIndex + 1)
    let outputPath = "\(outputRoot)/\(filename)"
    try jpeg.write(to: URL(fileURLWithPath: outputPath))

    let resize = Process()
    resize.executableURL = URL(fileURLWithPath: "/usr/bin/sips")
    resize.arguments = ["-z", "2868", "1320", outputPath]
    resize.standardOutput = FileHandle.nullDevice
    resize.standardError = FileHandle.nullDevice
    try resize.run()
    resize.waitUntilExit()
    guard resize.terminationStatus == 0 else {
        fatalError("대표 이미지 규격 변환에 실패했습니다: \(filename)")
    }
    print("hero: \(filename)")
}

// 업로드 대상이 아닌 검수용: 첫 두 장을 실제 배열처럼 나란히 보여준다.
let previewPaths = [
    "\(outputRoot)/01-jjaturi-app-store.jpg",
    "\(outputRoot)/02-jjaturi-app-store.jpg",
]
if let previewLeft = NSImage(contentsOfFile: previewPaths[0]),
   let previewRight = NSImage(contentsOfFile: previewPaths[1]) {
    let previewSize = NSSize(width: 1320, height: 1434)
    let preview = NSImage(size: previewSize)
    preview.lockFocusFlipped(true)
    previewLeft.draw(
        in: NSRect(x: 0, y: 0, width: 660, height: 1434),
        from: NSRect(origin: .zero, size: previewLeft.size),
        operation: .sourceOver,
        fraction: 1,
        respectFlipped: true,
        hints: [.interpolation: NSImageInterpolation.high.rawValue]
    )
    previewRight.draw(
        in: NSRect(x: 660, y: 0, width: 660, height: 1434),
        from: NSRect(origin: .zero, size: previewRight.size),
        operation: .sourceOver,
        fraction: 1,
        respectFlipped: true,
        hints: [.interpolation: NSImageInterpolation.high.rawValue]
    )
    preview.unlockFocus()

    if let tiff = preview.tiffRepresentation,
       let bitmap = NSBitmapImageRep(data: tiff),
       let jpeg = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.94]) {
        let previewPath = "\(outputRoot)/preview-hero-pair-not-for-upload.jpg"
        try jpeg.write(to: URL(fileURLWithPath: previewPath))
        let resize = Process()
        resize.executableURL = URL(fileURLWithPath: "/usr/bin/sips")
        resize.arguments = ["-z", "1434", "1320", previewPath]
        resize.standardOutput = FileHandle.nullDevice
        resize.standardError = FileHandle.nullDevice
        try resize.run()
        resize.waitUntilExit()
        print("preview: preview-hero-pair-not-for-upload.jpg")
    }
}
