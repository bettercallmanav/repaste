import Foundation
import Vision

let arguments = CommandLine.arguments
guard arguments.count >= 2 else {
  fputs("Missing image path\n", stderr)
  exit(2)
}

let imagePath = arguments[1]
guard FileManager.default.fileExists(atPath: imagePath) else {
  fputs("Image path does not exist\n", stderr)
  exit(3)
}

let imageURL = URL(fileURLWithPath: imagePath)
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

if #available(macOS 13.0, *) {
  request.automaticallyDetectsLanguage = true
}

let handler = VNImageRequestHandler(url: imageURL)

do {
  try handler.perform([request])
  let text = (request.results ?? [])
    .compactMap { observation in
      observation.topCandidates(1).first?.string
    }
    .joined(separator: "\n")
    .trimmingCharacters(in: .whitespacesAndNewlines)

  if !text.isEmpty {
    FileHandle.standardOutput.write(Data(text.utf8))
  }
} catch {
  fputs("Vision OCR failed: \(error.localizedDescription)\n", stderr)
  exit(1)
}
